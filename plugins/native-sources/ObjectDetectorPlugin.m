#import <VisionCamera/FrameProcessorPlugin.h>
#import <VisionCamera/FrameProcessorPluginRegistry.h>
#import <VisionCamera/Frame.h>

// Import the Swift-generated header so ObjC can see our Swift class
#import "Frame-Swift.h"

VISION_EXPORT_SWIFT_FRAME_PROCESSOR(ObjectDetectorPlugin, detectObjects)
