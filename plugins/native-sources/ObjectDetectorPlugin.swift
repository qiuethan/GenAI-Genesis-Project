import Vision
import CoreML
import UIKit

private let cocoLabels: [String] = [
  "person", "bicycle", "car", "motorcycle", "airplane", "bus", "train", "truck", "boat",
  "traffic light", "fire hydrant", "stop sign", "parking meter", "bench", "bird", "cat",
  "dog", "horse", "sheep", "cow", "elephant", "bear", "zebra", "giraffe", "backpack",
  "umbrella", "handbag", "tie", "suitcase", "frisbee", "skis", "snowboard", "sports ball",
  "kite", "baseball bat", "baseball glove", "skateboard", "surfboard", "tennis racket",
  "bottle", "wine glass", "cup", "fork", "knife", "spoon", "bowl", "banana", "apple",
  "sandwich", "orange", "broccoli", "carrot", "hot dog", "pizza", "donut", "cake", "chair",
  "couch", "potted plant", "bed", "dining table", "toilet", "tv", "laptop", "mouse",
  "remote", "keyboard", "cell phone", "microwave", "oven", "toaster", "sink", "refrigerator",
  "book", "clock", "vase", "scissors", "teddy bear", "hair drier", "toothbrush"
]

@objc(ObjectDetectorPlugin)
public class ObjectDetectorPlugin: FrameProcessorPlugin {
  private var mlModel: MLModel?
  private var logCount = 0

  public override init(proxy: VisionCameraProxyHolder, options: [AnyHashable: Any]! = [:]) {
    super.init(proxy: proxy, options: options)
    loadModel()
  }

  private func loadModel() {
    if let compiledURL = Bundle.main.url(forResource: "yolo11s", withExtension: "mlmodelc") {
      self.mlModel = try? MLModel(contentsOf: compiledURL)
      if mlModel != nil { print("[ObjectDetector] Loaded yolo11s.mlmodelc"); return }
    }
    if let packageURL = Bundle.main.url(forResource: "yolo11s", withExtension: "mlpackage") {
      if let compiledURL = try? MLModel.compileModel(at: packageURL) {
        self.mlModel = try? MLModel(contentsOf: compiledURL)
        if mlModel != nil { print("[ObjectDetector] Compiled yolo11s.mlpackage"); return }
      }
    }
    print("[ObjectDetector] WARNING: No model found")
  }

  public override func callback(_ frame: Frame, withArguments arguments: [AnyHashable: Any]?) -> Any? {
    guard let mlModel = self.mlModel else { return [] as [[String: Any]] }
    let confThreshold = (arguments?["confidence"] as? NSNumber)?.floatValue ?? 0.3

    guard let pixelBuffer = CMSampleBufferGetImageBuffer(frame.buffer) else {
      return [] as [[String: Any]]
    }

    // Run CoreML directly (not via VNCoreMLRequest which mangles the output)
    let imgWidth = CVPixelBufferGetWidth(pixelBuffer)
    let imgHeight = CVPixelBufferGetHeight(pixelBuffer)

    // Resize to 640x640 for model input
    guard let resized = resizePixelBuffer(pixelBuffer, width: 640, height: 640) else {
      return [] as [[String: Any]]
    }

    do {
      let input = try MLDictionaryFeatureProvider(dictionary: [
        "image": resized,
      ])
      let prediction = try mlModel.prediction(from: input)

      // Get the raw output tensor
      var rawOutput: MLMultiArray?
      for name in prediction.featureNames {
        if let arr = prediction.featureValue(for: name)?.multiArrayValue {
          rawOutput = arr
          break
        }
      }

      guard let output = rawOutput else {
        if logCount < 3 { print("[ObjectDetector] No output tensor found"); logCount += 1 }
        return [] as [[String: Any]]
      }

      // Debug log first few calls
      if logCount < 3 {
        print("[ObjectDetector] Output shape: \(output.shape), strides: \(output.strides)")
        logCount += 1
      }

      return parseOutput(output, confThreshold: confThreshold)
    } catch {
      if logCount < 5 { print("[ObjectDetector] Prediction error: \(error)"); logCount += 1 }
      return [] as [[String: Any]]
    }
  }

  private func parseOutput(_ output: MLMultiArray, confThreshold: Float) -> [[String: Any]] {
    // Expected shape: [1, 84, 8400]
    guard output.shape.count == 3 else { return [] }

    let dim1 = output.shape[1].intValue  // 84
    let dim2 = output.shape[2].intValue  // 8400
    let numClasses = dim1 - 4            // 80

    guard numClasses == 80 else {
      if logCount < 3 { print("[ObjectDetector] Unexpected dims: \(dim1)x\(dim2)"); logCount += 1 }
      return []
    }

    let ptr = output.dataPointer.bindMemory(to: Float.self, capacity: output.count)

    var detections: [[String: Any]] = []

    for i in 0..<dim2 {
      var bestCls = 0
      var bestConf: Float = 0
      for c in 0..<numClasses {
        let conf = ptr[(4 + c) * dim2 + i]
        if conf > bestConf { bestConf = conf; bestCls = c }
      }
      if bestConf < confThreshold { continue }

      let cx = ptr[0 * dim2 + i]
      let cy = ptr[1 * dim2 + i]
      let w  = ptr[2 * dim2 + i]
      let h  = ptr[3 * dim2 + i]

      // Normalize from 640x640 model space to 0-1 (in landscape buffer coords)
      let x1 = Double(max(0, (cx - w / 2)) / 640.0)
      let y1 = Double(max(0, (cy - h / 2)) / 640.0)
      let x2 = Double(min(1, (cx + w / 2) / 640.0))
      let y2 = Double(min(1, (cy + h / 2) / 640.0))

      let label = bestCls < cocoLabels.count ? cocoLabels[bestCls] : "cls_\(bestCls)"
      detections.append([
        "label": label,
        "confidence": Double(bestConf),
        "x1": x1, "y1": y1, "x2": x2, "y2": y2,
      ])
    }

    // NMS
    let sorted = detections.sorted { ($0["confidence"] as! Double) > ($1["confidence"] as! Double) }
    var kept: [[String: Any]] = []
    for det in sorted {
      if kept.count >= 15 { break }
      let dominated = kept.contains { iou($0, det) > 0.45 }
      if !dominated { kept.append(det) }
    }
    return kept
  }

  private func iou(_ a: [String: Any], _ b: [String: Any]) -> Double {
    let ax1 = a["x1"] as! Double, ay1 = a["y1"] as! Double
    let ax2 = a["x2"] as! Double, ay2 = a["y2"] as! Double
    let bx1 = b["x1"] as! Double, by1 = b["y1"] as! Double
    let bx2 = b["x2"] as! Double, by2 = b["y2"] as! Double
    let ix1 = max(ax1, bx1), iy1 = max(ay1, by1)
    let ix2 = min(ax2, bx2), iy2 = min(ay2, by2)
    let inter = max(0, ix2 - ix1) * max(0, iy2 - iy1)
    let union = (ax2 - ax1) * (ay2 - ay1) + (bx2 - bx1) * (by2 - by1) - inter
    return inter / (union + 1e-6)
  }

  private func resizePixelBuffer(_ buffer: CVPixelBuffer, width: Int, height: Int) -> CVPixelBuffer? {
    var output: CVPixelBuffer?
    let attrs = [
      kCVPixelBufferCGImageCompatibilityKey: kCFBooleanTrue!,
      kCVPixelBufferCGBitmapContextCompatibilityKey: kCFBooleanTrue!,
    ] as CFDictionary

    CVPixelBufferCreate(kCFAllocatorDefault, width, height,
                        kCVPixelFormatType_32BGRA, attrs, &output)
    guard let out = output else { return nil }

    let ciImage = CIImage(cvPixelBuffer: buffer)
    let sx = CGFloat(width) / CGFloat(CVPixelBufferGetWidth(buffer))
    let sy = CGFloat(height) / CGFloat(CVPixelBufferGetHeight(buffer))
    let scaled = ciImage.transformed(by: CGAffineTransform(scaleX: sx, y: sy))

    let ctx = CIContext(options: [.useSoftwareRenderer: false])
    ctx.render(scaled, to: out)
    return out
  }
}
