"""TANet: Theme-Adaptive Network for Image Aesthetics Assessment.

Adapted from https://github.com/woshidandan/TANet-image-aesthetics-and-quality-assessment
Three-branch architecture: ResNet-18 (Places365) + MobileNetV2 + Attention.
Fixed for MPS/CPU (removed hardcoded .cuda() calls).
"""

import math
import torch
import torch.nn as nn
import torch.nn.functional as F
import torchvision.models as models


def conv_bn(inp, oup, stride):
    return nn.Sequential(
        nn.Conv2d(inp, oup, 3, stride, 1, bias=False),
        nn.BatchNorm2d(oup),
        nn.ReLU(inplace=True),
    )


def conv_1x1_bn(inp, oup):
    return nn.Sequential(
        nn.Conv2d(inp, oup, 1, 1, 0, bias=False),
        nn.BatchNorm2d(oup),
        nn.ReLU(inplace=True),
    )


class InvertedResidual(nn.Module):
    def __init__(self, inp, oup, stride, expand_ratio):
        super().__init__()
        self.stride = stride
        self.use_res_connect = stride == 1 and inp == oup
        self.conv = nn.Sequential(
            nn.Conv2d(inp, inp * expand_ratio, 1, 1, 0, bias=False),
            nn.BatchNorm2d(inp * expand_ratio),
            nn.ReLU6(inplace=True),
            nn.Conv2d(inp * expand_ratio, inp * expand_ratio, 3, stride, 1,
                      groups=inp * expand_ratio, bias=False),
            nn.BatchNorm2d(inp * expand_ratio),
            nn.ReLU6(inplace=True),
            nn.Conv2d(inp * expand_ratio, oup, 1, 1, 0, bias=False),
            nn.BatchNorm2d(oup),
        )

    def forward(self, x):
        if self.use_res_connect:
            return x + self.conv(x)
        return self.conv(x)


class MobileNetV2(nn.Module):
    def __init__(self, n_class=1000, input_size=224, width_mult=1.0):
        super().__init__()
        setting = [
            [1, 16, 1, 1], [6, 24, 2, 2], [6, 32, 3, 2], [6, 64, 4, 2],
            [6, 96, 3, 1], [6, 160, 3, 2], [6, 320, 1, 1],
        ]
        input_channel = int(32 * width_mult)
        self.last_channel = int(1280 * width_mult) if width_mult > 1.0 else 1280
        features = [conv_bn(3, input_channel, 2)]
        for t, c, n, s in setting:
            output_channel = int(c * width_mult)
            for i in range(n):
                features.append(InvertedResidual(
                    input_channel, output_channel, s if i == 0 else 1, t))
                input_channel = output_channel
        features.append(conv_1x1_bn(input_channel, self.last_channel))
        self.features = nn.Sequential(*features)
        self.avgpool = nn.AvgPool2d(input_size // 32)
        self.classifier = nn.Sequential(nn.Dropout(), nn.Linear(self.last_channel, n_class))

    def forward(self, x):
        x = self.features(x)
        x = self.avgpool(x)
        x = x.view(-1, self.last_channel)
        return self.classifier(x)


def _attention(x):
    """Compute self-attention similarity map."""
    b, c, h, w = x.size()
    query = x.view(b, c, -1)
    key = query
    query = query.permute(0, 2, 1)
    sim = torch.matmul(query, key)
    ql2 = torch.norm(query, dim=2, keepdim=True)
    kl2 = torch.norm(key, dim=1, keepdim=True)
    return torch.div(sim, torch.matmul(ql2, kl2).clamp(min=1e-8))


class L5(nn.Module):
    """MobileNetV2 branch."""
    def __init__(self):
        super().__init__()
        mv2 = MobileNetV2()
        self.base_model = nn.Sequential(*list(mv2.children())[:-1])
        self.head = nn.Sequential(
            nn.ReLU(inplace=True), nn.Dropout(p=0.75), nn.Linear(1280, 10))

    def forward(self, x):
        x = self.base_model(x)
        return self.head(x.view(x.size(0), -1))


class TargetFC(nn.Module):
    def __init__(self, weight, bias):
        super().__init__()
        self.weight = weight
        self.bias = bias

    def forward(self, x):
        return F.linear(x, self.weight, self.bias)


class L1(nn.Module):
    """HyperNetwork: generates dynamic weights from ResNet-18 features."""
    def __init__(self):
        super().__init__()
        self.last_out_w = nn.Linear(365, 100)
        self.last_out_b = nn.Linear(365, 1)

    def forward(self, x):
        return {
            'res_last_out_w': self.last_out_w(x),
            'res_last_out_b': self.last_out_b(x),
        }


class TargetNet(nn.Module):
    """Dynamic target network with HyperNetwork-generated weights."""
    def __init__(self):
        super().__init__()
        self.fc1 = nn.Linear(365, 100)
        self.bn1 = nn.BatchNorm1d(100)
        self.relu1 = nn.PReLU()
        self.drop1 = nn.Dropout(0.5)
        self.relu7 = nn.PReLU()  # kept for weight compat
        self.sig = nn.Sigmoid()
        self.softmax = nn.Softmax(dim=1)

    def forward(self, x, paras):
        q = self.drop1(self.relu1(self.bn1(self.fc1(x))))
        q = F.linear(q, paras['res_last_out_w'], paras['res_last_out_b'])
        return self.softmax(q)


class TANet(nn.Module):
    """Three-branch Theme-Adaptive Network."""
    def __init__(self, places365_path=None):
        super().__init__()
        # Branch 1: ResNet-18 pretrained on Places365
        self.res365_last = models.resnet18(num_classes=365)
        if places365_path:
            ckpt = torch.load(places365_path, map_location='cpu')
            state = {k.replace('module.', ''): v for k, v in ckpt['state_dict'].items()}
            self.res365_last.load_state_dict(state)

        self.hypernet = L1()
        self.tygertnet = TargetNet()
        self.avg = nn.AdaptiveAvgPool2d((10, 1))

        # Branch 2: Attention on raw RGB
        self.avg_RGB = nn.AdaptiveAvgPool2d((12, 12))
        self.head_rgb = nn.Sequential(
            nn.ReLU(), nn.Dropout(p=0.75), nn.Linear(20736, 10), nn.Softmax(dim=1))

        # Branch 3: MobileNetV2
        self.mobileNet = L5()

        # Fusion head (TAD66K variant: single sigmoid score)
        self.head = nn.Sequential(
            nn.ReLU(), nn.Dropout(p=0.75), nn.Linear(30, 1), nn.Sigmoid())

    def forward(self, x):
        # Attention branch
        x_att = _attention(self.avg_RGB(x))
        x_att = self.head_rgb(x_att.view(x_att.size(0), -1))

        # ResNet-18 + HyperNet branch
        res_out = self.res365_last(x)
        paras = self.hypernet(res_out)
        hyper_out = self.tygertnet(res_out, paras)
        hyper_out = self.avg(hyper_out.unsqueeze(2)).squeeze(2)

        # MobileNetV2 branch
        mv2_out = self.mobileNet(x)

        # Fuse all three
        fused = torch.cat([mv2_out, hyper_out, x_att], dim=1)
        return self.head(fused)
