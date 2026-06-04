#import <AVFoundation/AVFoundation.h>
#import <CoreGraphics/CoreGraphics.h>
#import <Foundation/Foundation.h>
#import <ImageIO/ImageIO.h>

static void Fail(NSString *message) {
  fprintf(stderr, "%s\n", [message UTF8String]);
  exit(1);
}

static CGImageRef LoadImage(NSURL *url) {
  CGImageSourceRef source = CGImageSourceCreateWithURL((__bridge CFURLRef)url, NULL);
  if (!source) Fail([NSString stringWithFormat:@"Could not open %@", url.path]);
  CGImageRef image = CGImageSourceCreateImageAtIndex(source, 0, NULL);
  CFRelease(source);
  if (!image) Fail([NSString stringWithFormat:@"Could not decode %@", url.path]);
  return image;
}

static CVPixelBufferRef PixelBufferFromImage(CGImageRef image, size_t width, size_t height) {
  CVPixelBufferRef buffer = NULL;
  NSDictionary *attrs = @{
    (NSString *)kCVPixelBufferCGImageCompatibilityKey: @YES,
    (NSString *)kCVPixelBufferCGBitmapContextCompatibilityKey: @YES
  };
  CVReturn status = CVPixelBufferCreate(kCFAllocatorDefault, width, height, kCVPixelFormatType_32ARGB, (__bridge CFDictionaryRef)attrs, &buffer);
  if (status != kCVReturnSuccess || !buffer) Fail(@"Could not create pixel buffer");

  CVPixelBufferLockBaseAddress(buffer, 0);
  CGContextRef context = CGBitmapContextCreate(
    CVPixelBufferGetBaseAddress(buffer),
    width,
    height,
    8,
    CVPixelBufferGetBytesPerRow(buffer),
    CGColorSpaceCreateDeviceRGB(),
    kCGImageAlphaNoneSkipFirst
  );
  if (!context) Fail(@"Could not create bitmap context");
  CGContextSetRGBFillColor(context, 0, 0, 0, 1);
  CGContextFillRect(context, CGRectMake(0, 0, width, height));
  CGContextDrawImage(context, CGRectMake(0, 0, width, height), image);
  CGContextRelease(context);
  CVPixelBufferUnlockBaseAddress(buffer, 0);
  return buffer;
}

int main(int argc, const char *argv[]) {
  @autoreleasepool {
    if (argc < 5) {
      Fail(@"Usage: make-video-from-pngs <framesDir> <outputMp4> <fps> <secondsPerFrame>");
    }

    NSString *framesPath = [NSString stringWithUTF8String:argv[1]];
    NSString *outputPath = [NSString stringWithUTF8String:argv[2]];
    int32_t fps = (int32_t)atoi(argv[3]);
    double secondsPerFrame = atof(argv[4]);
    if (fps <= 0) fps = 24;
    if (secondsPerFrame <= 0) secondsPerFrame = 0.25;

    NSFileManager *fm = [NSFileManager defaultManager];
    NSArray<NSString *> *names = [[fm contentsOfDirectoryAtPath:framesPath error:nil] filteredArrayUsingPredicate:[NSPredicate predicateWithBlock:^BOOL(NSString *name, NSDictionary *bindings) {
      return [[name.pathExtension lowercaseString] isEqualToString:@"png"];
    }]];
    names = [names sortedArrayUsingSelector:@selector(localizedStandardCompare:)];
    if (names.count == 0) Fail(@"No PNG frames found");

    NSURL *firstURL = [NSURL fileURLWithPath:[framesPath stringByAppendingPathComponent:names.firstObject]];
    CGImageRef firstImage = LoadImage(firstURL);
    size_t width = CGImageGetWidth(firstImage);
    size_t height = CGImageGetHeight(firstImage);
    CGImageRelease(firstImage);

    NSURL *outputURL = [NSURL fileURLWithPath:outputPath];
    [fm removeItemAtURL:outputURL error:nil];

    NSError *error = nil;
    AVFileType fileType = [[outputPath.pathExtension lowercaseString] isEqualToString:@"mov"] ? AVFileTypeQuickTimeMovie : AVFileTypeMPEG4;
    AVAssetWriter *writer = [[AVAssetWriter alloc] initWithURL:outputURL fileType:fileType error:&error];
    if (!writer || error) Fail([NSString stringWithFormat:@"Could not create writer: %@", error.localizedDescription]);

    NSDictionary *settings = nil;
    if ([fileType isEqualToString:AVFileTypeQuickTimeMovie]) {
      settings = @{
        AVVideoCodecKey: AVVideoCodecTypeAppleProRes422,
        AVVideoWidthKey: @(width),
        AVVideoHeightKey: @(height)
      };
    } else {
      settings = @{
        AVVideoCodecKey: AVVideoCodecTypeH264,
        AVVideoWidthKey: @(width),
        AVVideoHeightKey: @(height),
        AVVideoCompressionPropertiesKey: @{
          AVVideoAverageBitRateKey: @3500000
        }
      };
    }
    AVAssetWriterInput *input = [AVAssetWriterInput assetWriterInputWithMediaType:AVMediaTypeVideo outputSettings:settings];
    input.expectsMediaDataInRealTime = NO;

    NSDictionary *pixelAttrs = @{
      (NSString *)kCVPixelBufferPixelFormatTypeKey: @(kCVPixelFormatType_32ARGB),
      (NSString *)kCVPixelBufferWidthKey: @(width),
      (NSString *)kCVPixelBufferHeightKey: @(height)
    };
    AVAssetWriterInputPixelBufferAdaptor *adaptor = [AVAssetWriterInputPixelBufferAdaptor assetWriterInputPixelBufferAdaptorWithAssetWriterInput:input sourcePixelBufferAttributes:pixelAttrs];
    if (![writer canAddInput:input]) Fail(@"Cannot add writer input");
    [writer addInput:input];

    if (![writer startWriting]) {
      NSError *writerError = writer.error;
      Fail([NSString stringWithFormat:@"Could not start writer: %@ domain=%@ code=%ld userInfo=%@",
        writerError.localizedDescription,
        writerError.domain,
        (long)writerError.code,
        writerError.userInfo
      ]);
    }
    [writer startSessionAtSourceTime:kCMTimeZero];

    CMTime frameDuration = CMTimeMakeWithSeconds(secondsPerFrame, fps * 100);
    int64_t frameIndex = 0;

    for (NSString *name in names) {
      while (!input.readyForMoreMediaData) {
        [NSThread sleepForTimeInterval:0.01];
      }
      NSURL *url = [NSURL fileURLWithPath:[framesPath stringByAppendingPathComponent:name]];
      CGImageRef image = LoadImage(url);
      CVPixelBufferRef buffer = PixelBufferFromImage(image, width, height);
      CMTime time = CMTimeMultiply(frameDuration, (int32_t)frameIndex);
      if (![adaptor appendPixelBuffer:buffer withPresentationTime:time]) {
        Fail([NSString stringWithFormat:@"Could not append frame %@: %@", name, writer.error.localizedDescription]);
      }
      CVPixelBufferRelease(buffer);
      CGImageRelease(image);
      frameIndex++;
    }

    [input markAsFinished];
    dispatch_semaphore_t sema = dispatch_semaphore_create(0);
    [writer finishWritingWithCompletionHandler:^{
      dispatch_semaphore_signal(sema);
    }];
    dispatch_semaphore_wait(sema, DISPATCH_TIME_FOREVER);

    if (writer.status != AVAssetWriterStatusCompleted) {
      Fail([NSString stringWithFormat:@"Writing failed: %@", writer.error.localizedDescription]);
    }

    printf("%s\n", [outputPath UTF8String]);
  }
  return 0;
}
