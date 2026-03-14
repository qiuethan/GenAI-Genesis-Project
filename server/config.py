"""Inference-only configuration for SAMP-Net."""


class Config:
    # Model architecture
    score_level = 5
    resnet_layers = 18  # Will be auto-detected from checkpoint
    dropout = 0.5
    pool_dropout = 0.5
    image_size = 224

    # SAMP-Net feature flags
    use_weighted_loss = True
    use_attribute = True
    use_channel_attention = True
    use_saliency = True
    use_multipattern = True
    use_pattern_weight = True

    # Composition patterns
    pattern_list = [1, 2, 3, 4, 5, 6, 7, 8]
    pattern_fuse = 'sum'

    # Attributes (must match pretrained model)
    attribute_types = [
        'RuleOfThirds', 'BalacingElements', 'DoF',
        'Object', 'Symmetry', 'Repetition',
    ]
    num_attributes = len(attribute_types)
