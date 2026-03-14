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

/// Letterbox info: how the original image was placed inside the 640x640 square
struct LetterboxInfo {
  let scale: CGFloat      // uniform scale applied to original image
  let padX: CGFloat       // horizontal padding (left) in pixels in 640x640 space
  let padY: CGFloat       // vertical padding (top) in pixels in 640x640 space
  let origWidth: CGFloat  // original image width
  let origHeight: CGFloat // original image height
}

@objc(ObjectDetectorPlugin)
public class ObjectDetectorPlugin: FrameProcessorPlugin {
  private var mlModel: MLModel?
  private var ciContext = CIContext(options: [.useSoftwareRenderer: false])
  private var logCount = 0

  public override init(proxy: VisionCameraProxyHolder, options: [AnyHashable: Any]! = [:]) {
    super.init(proxy: proxy, options: options)
    loadModel()
  }

  private func loadModel() {
    if let url = Bundle.main.url(forResource: "yolo11s", withExtension: "mlmodelc") {
      self.mlModel = try? MLModel(contentsOf: url)
      if mlModel != nil { print("[ObjectDetector] Loaded yolo11s.mlmodelc"); return }
    }
    if let url = Bundle.main.url(forResource: "yolo11s", withExtension: "mlpackage") {
      if let compiled = try? MLModel.compileModel(at: url) {
        self.mlModel = try? MLModel(contentsOf: compiled)
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

    let origW = CGFloat(CVPixelBufferGetWidth(pixelBuffer))
    let origH = CGFloat(CVPixelBufferGetHeight(pixelBuffer))

    // Letterbox to 640x640
    guard let (letterboxed, info) = letterboxPixelBuffer(pixelBuffer, targetSize: 640) else {
      return [] as [[String: Any]]
    }

    do {
      let input = try MLDictionaryFeatureProvider(dictionary: ["image": letterboxed])
      let prediction = try mlModel.prediction(from: input)

      var rawOutput: MLMultiArray?
      for name in prediction.featureNames {
        if let arr = prediction.featureValue(for: name)?.multiArrayValue {
          rawOutput = arr
          break
        }
      }
      guard let output = rawOutput else { return [] as [[String: Any]] }

      if logCount < 3 {
        print("[ObjectDetector] Output shape: \(output.shape) origSize: \(origW)x\(origH) scale: \(info.scale) pad: \(info.padX),\(info.padY)")
        logCount += 1
      }

      return parseOutput(output, confThreshold: confThreshold, info: info)
    } catch {
      if logCount < 5 { print("[ObjectDetector] Error: \(error)"); logCount += 1 }
      return [] as [[String: Any]]
    }
  }

  // MARK: - Letterboxing

  /// Letterbox: scale uniformly to fit inside targetSize x targetSize, pad with black
  private func letterboxPixelBuffer(_ buffer: CVPixelBuffer, targetSize: Int) -> (CVPixelBuffer, LetterboxInfo)? {
    let origW = CGFloat(CVPixelBufferGetWidth(buffer))
    let origH = CGFloat(CVPixelBufferGetHeight(buffer))
    let target = CGFloat(targetSize)

    // Uniform scale to fit
    let scale = min(target / origW, target / origH)
    let newW = origW * scale
    let newH = origH * scale
    let padX = (target - newW) / 2.0
    let padY = (target - newH) / 2.0

    let info = LetterboxInfo(scale: scale, padX: padX, padY: padY, origWidth: origW, origHeight: origH)

    // Create output buffer
    var output: CVPixelBuffer?
    let attrs = [
      kCVPixelBufferCGImageCompatibilityKey: kCFBooleanTrue!,
      kCVPixelBufferCGBitmapContextCompatibilityKey: kCFBooleanTrue!,
    ] as CFDictionary
    CVPixelBufferCreate(kCFAllocatorDefault, targetSize, targetSize,
                        kCVPixelFormatType_32BGRA, attrs, &output)
    guard let out = output else { return nil }

    // Fill with black
    CVPixelBufferLockBaseAddress(out, [])
    let baseAddr = CVPixelBufferGetBaseAddress(out)!
    memset(baseAddr, 0, CVPixelBufferGetDataSize(out))
    CVPixelBufferUnlockBaseAddress(out, [])

    // Scale and position the image
    let ciImage = CIImage(cvPixelBuffer: buffer)
    let scaled = ciImage
      .transformed(by: CGAffineTransform(scaleX: scale, y: scale))
      .transformed(by: CGAffineTransform(translationX: padX, y: padY))

    ciContext.render(scaled, to: out)
    return (out, info)
  }

  // MARK: - Output parsing

  private func parseOutput(_ output: MLMultiArray, confThreshold: Float, info: LetterboxInfo) -> [[String: Any]] {
    guard output.shape.count == 3 else { return [] }
    let dim1 = output.shape[1].intValue  // 84
    let dim2 = output.shape[2].intValue  // 8400
    let numClasses = dim1 - 4
    guard numClasses == 80 else { return [] }

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

      // Coords in 640x640 model space
      let cx = CGFloat(ptr[0 * dim2 + i])
      let cy = CGFloat(ptr[1 * dim2 + i])
      let w  = CGFloat(ptr[2 * dim2 + i])
      let h  = CGFloat(ptr[3 * dim2 + i])

      // Remove letterbox padding and scale back to original image coords
      let ox1 = (cx - w / 2 - info.padX) / info.scale
      let oy1 = (cy - h / 2 - info.padY) / info.scale
      let ox2 = (cx + w / 2 - info.padX) / info.scale
      let oy2 = (cy + h / 2 - info.padY) / info.scale

      // Normalize to 0-1 relative to original image
      let x1 = Double(max(0, ox1) / info.origWidth)
      let y1 = Double(max(0, oy1) / info.origHeight)
      let x2 = Double(min(info.origWidth, ox2) / info.origWidth)
      let y2 = Double(min(info.origHeight, oy2) / info.origHeight)

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
}
