"""
SAMP-Net: Saliency-Augmented Multi-Pattern Pooling Network.
Adapted from https://github.com/bcmi/Image-Composition-Assessment-Dataset-CADB
Fixed imports for local package structure.
"""

import warnings

import torch
import torch.nn as nn
import torch.nn.functional as F
import torchvision.models as models

from .samp_module import MPPModule, SAMPPModule

warnings.filterwarnings('ignore')


class SAPModule(nn.Module):
    def __init__(self, input_channel, output_channel, saliency_size, dropout):
        super().__init__()
        self.pooling = nn.Sequential(
            nn.AdaptiveAvgPool2d(1),
            nn.Flatten(1),
            nn.Dropout(dropout),
        )
        sal_feat_len = saliency_size * saliency_size
        self.feature_layer = nn.Sequential(
            nn.Linear(input_channel + sal_feat_len, output_channel, bias=False),
            nn.Dropout(dropout),
        )

    def forward(self, x, s):
        x = self.pooling(x)
        s = s.flatten(1)
        f = self.feature_layer(torch.cat([x, s], dim=1))
        return f


def build_resnet(layers, pretrained=False):
    assert layers in [18, 34, 50, 101], f'layers must be one of [18, 34, 50, 101], got {layers}'
    builder = {18: models.resnet18, 34: models.resnet34, 50: models.resnet50, 101: models.resnet101}
    resnet = builder[layers](weights=None)
    modules = list(resnet.children())[:-2]
    return nn.Sequential(*modules)


class SAMPNet(nn.Module):
    def __init__(self, cfg, pretrained=True):
        super().__init__()
        score_level = cfg.score_level
        layers = cfg.resnet_layers
        dropout = cfg.dropout
        num_attributes = cfg.num_attributes
        input_channel = 512 if layers in [18, 34] else 2048
        sal_dim = 512
        pool_dropout = cfg.pool_dropout
        pattern_list = cfg.pattern_list
        pattern_fuse = cfg.pattern_fuse

        self.use_weighted_loss = cfg.use_weighted_loss
        self.use_attribute = cfg.use_attribute
        self.use_channel_attention = cfg.use_channel_attention
        self.use_saliency = cfg.use_saliency
        self.use_multipattern = cfg.use_multipattern
        self.use_pattern_weight = cfg.use_pattern_weight

        self.backbone = build_resnet(layers, pretrained=pretrained)
        self.global_pool = nn.Sequential(
            nn.AdaptiveAvgPool2d(1),
            nn.Dropout(dropout),
            nn.Flatten(1),
        )

        output_channel = input_channel
        if self.use_multipattern:
            if self.use_saliency:
                self.saliency_max = nn.Sequential(
                    nn.MaxPool2d(kernel_size=3, stride=2, padding=1),
                    nn.MaxPool2d(kernel_size=3, stride=2, padding=1),
                )
                self.pattern_module = SAMPPModule(
                    input_channel, input_channel + sal_dim,
                    saliency_size=56, dropout=pool_dropout,
                    pattern_list=pattern_list, fusion=pattern_fuse,
                )
                output_channel = input_channel + sal_dim
            else:
                self.pattern_module = MPPModule(
                    input_channel, input_channel,
                    dropout=pool_dropout,
                    pattern_list=pattern_list, fusion=pattern_fuse,
                )
                output_channel = input_channel
            if self.use_pattern_weight:
                self.pattern_weight_layer = nn.Sequential(
                    nn.AdaptiveAvgPool2d(1),
                    nn.Dropout(dropout),
                    nn.Flatten(1),
                    nn.Linear(input_channel, len(pattern_list), bias=False),
                )
        else:
            if self.use_saliency:
                self.saliency_max = nn.Sequential(
                    nn.MaxPool2d(kernel_size=3, stride=2, padding=1),
                    nn.MaxPool2d(kernel_size=3, stride=2, padding=1),
                )
                self.pattern_module = SAPModule(
                    input_channel, input_channel + sal_dim,
                    saliency_size=56, dropout=pool_dropout,
                )
                output_channel = input_channel + sal_dim

        if self.use_attribute:
            concat_dim = output_channel
            att_dim = 512 if concat_dim >= 1024 else concat_dim // 2
            com_dim = concat_dim - att_dim
            self.att_feature_layer = nn.Sequential(
                nn.Linear(concat_dim, att_dim, bias=False),
                nn.ReLU(True),
                nn.Dropout(dropout),
            )
            self.att_pred_layer = nn.Sequential(
                nn.Linear(att_dim, num_attributes, bias=False),
            )
            self.com_feature_layer = nn.Sequential(
                nn.Linear(concat_dim, com_dim, bias=False),
                nn.ReLU(True),
                nn.Dropout(dropout),
            )
            if self.use_channel_attention:
                self.alpha_predict_layer = nn.Sequential(
                    nn.Linear(concat_dim, 2, bias=False),
                    nn.Sigmoid(),
                )

        self.com_pred_layer = nn.Sequential(
            nn.Linear(output_channel, output_channel, bias=False),
            nn.ReLU(True),
            nn.Dropout(dropout),
            nn.Linear(output_channel, input_channel, bias=False),
            nn.ReLU(True),
            nn.Linear(input_channel, score_level, bias=False),
            nn.Softmax(dim=1),
        )

    def forward(self, x, s):
        feature_map = self.backbone(x)
        weight = None
        attribute = None

        if self.use_multipattern:
            if self.use_pattern_weight:
                weight = self.pattern_weight_layer(feature_map)
            if self.use_saliency:
                sal_map = self.saliency_max(s)
                pattern_feat = self.pattern_module(feature_map, sal_map, weight)
            else:
                pattern_feat = self.pattern_module(feature_map, weight)
        else:
            if self.use_saliency:
                sal_map = self.saliency_max(s)
                pattern_feat = self.pattern_module(feature_map, sal_map)
            else:
                pattern_feat = self.global_pool(feature_map)

        if self.use_attribute:
            att_feat = self.att_feature_layer(pattern_feat)
            com_feat = self.com_feature_layer(pattern_feat)
            attribute = self.att_pred_layer(att_feat)
            fused_feat = torch.cat([att_feat, com_feat], dim=1)
            if self.use_channel_attention:
                alpha = self.alpha_predict_layer(fused_feat)
                fused_feat = torch.cat([alpha[:, 0:1] * att_feat, alpha[:, 1:] * com_feat], dim=1)
            scores = self.com_pred_layer(fused_feat)
        else:
            scores = self.com_pred_layer(pattern_feat)
        return weight, attribute, scores
