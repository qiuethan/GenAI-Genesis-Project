"""NIMA (Neural Image Assessment) with VGG16 backbone.

Weights from pyiqa (chaofengc/IQA-PyTorch) hosted on Hugging Face.
Predicts a 10-class probability distribution over aesthetic scores 1-10.
"""

import torch
import torch.nn as nn
import timm


class NIMA(nn.Module):
    def __init__(self, backbone='vgg16', num_classes=10):
        super().__init__()
        # timm features_only VGG16 uses 'features_N' naming
        self.base_model = timm.create_model(backbone, pretrained=False, features_only=True)
        # Get the channel count of the last feature map
        with torch.no_grad():
            dummy = torch.randn(1, 3, 224, 224)
            feats = self.base_model(dummy)
            channels = feats[-1].shape[1]
        self.classifier = nn.Sequential(
            nn.AdaptiveAvgPool2d(1),
            nn.Flatten(1),
            nn.Linear(channels, num_classes),
            nn.Softmax(dim=-1),
        )

    def forward(self, x):
        feats = self.base_model(x)
        return self.classifier(feats[-1])

    @staticmethod
    def load_pyiqa_weights(model, checkpoint_path):
        """Load weights from pyiqa format (params dict with base_model/classifier keys)."""
        state = torch.load(checkpoint_path, map_location='cpu', weights_only=True)
        if 'params' in state:
            state = state['params']
        model.load_state_dict(state)
        return model
