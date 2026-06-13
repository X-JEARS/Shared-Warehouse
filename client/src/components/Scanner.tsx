import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { Dialog, Button } from 'antd-mobile';
import { BrowserMultiFormatReader } from '@zxing/library';
import styled from 'styled-components';
import { useTranslation } from 'react-i18next';

const ScannerContainer = styled.div`
  position: relative;
  width: 100%;
  height: 300px;
  background: #000;
  border-radius: var(--app-radius-l);
  overflow: hidden;
`;

const Video = styled.video`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const Overlay = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 200px;
  height: 200px;
  border: 2px solid var(--app-color-primary);
  border-radius: var(--app-radius-l);
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5);
`;

const Hint = styled.div`
  position: absolute;
  bottom: 20px;
  left: 0;
  right: 0;
  text-align: center;
  color: var(--app-color-white);
  font-size: 14px;
`;

const PausedPlaceholder = styled.div`
  width: 100%;
  height: 300px;
  background: #000;
  border-radius: var(--app-radius-l);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--app-color-white);
  font-size: 14px;
`;

const TorchButton = styled.button<{ $active: boolean }>`
  position: absolute;
  top: 12px;
  right: 12px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: ${(props) => (props.$active ? 'var(--app-color-primary)' : 'rgba(0, 0, 0, 0.5)')};
  color: var(--app-color-white);
  font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 10;
  transition: background 0.2s;

  &:active {
    opacity: 0.8;
  }
`;

export interface ScannerHandle {
  restart: () => void;
  pause: () => void;
  resume: () => void;
}

interface ScannerProps {
  onScan: (result: string) => boolean | void | Promise<boolean | void>;
  onError?: (error: Error) => void;
  showStopButton?: boolean; // 是否显示内置的停止扫描按钮，默认 false
}

const Scanner = forwardRef<ScannerHandle, ScannerProps>(({ onScan, onError, showStopButton = false }, ref) => {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const stoppedRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  // 用 ref 持有最新的 onScan/onError，避免 decodeFromConstraints 回调中的闭包陈旧问题
  const onScanRef = useRef(onScan);
  const onErrorRef = useRef(onError);
  onScanRef.current = onScan;
  onErrorRef.current = onError;

  useImperativeHandle(ref, () => ({
    restart: () => {
      stopScanning();
      setTimeout(() => startScanning(), 100);
    },
    pause: () => {
      // 暂停时彻底释放摄像头，消除所有 GPU/CPU 开销
      const video = videoRef.current;
      if (video?.srcObject) {
        const stream = video.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        video.srcObject = null;
      }
      streamRef.current = null;
      if (readerRef.current) {
        try { readerRef.current.reset(); } catch (e) {}
        readerRef.current = null;
      }
      stoppedRef.current = true;
      setIsScanning(false);
      setIsPaused(true);
      setTorchEnabled(false);
      setTorchSupported(false);
    },
    resume: () => {
      setIsPaused(false);
      startScanning();
    },
  }));

  useEffect(() => {
    const timer = setTimeout(() => {
      startScanning();
    }, 100);
    return () => {
      clearTimeout(timer);
      stopScanning();
    };
  }, []);

  const startScanning = async () => {
    try {
      stoppedRef.current = false;
      const reader = new BrowserMultiFormatReader();
      readerRef.current = reader;

      // 优先选择后置摄像头（主摄像头）
      const videoInputDevices = await reader.listVideoInputDevices();
      if (videoInputDevices.length === 0) {
        Dialog.alert({ content: t('scannerComponent.noCamera') });
        return;
      }

      // 查找后置摄像头，如果没有则使用第一个可用摄像头
      let selectedDeviceId: string | undefined;
      const backCamera = videoInputDevices.find(
        (device) =>
          device.label.toLowerCase().includes('back') ||
          device.label.toLowerCase().includes('rear') ||
          device.label.toLowerCase().includes('environment') ||
          device.label.toLowerCase().includes('后置') ||
          device.label.toLowerCase().includes('主摄')
      );
      selectedDeviceId = backCamera ? backCamera.deviceId : undefined;

      setIsScanning(true);

      // 使用约束优先请求后置摄像头，并请求高分辨率和连续对焦
      const constraints: MediaStreamConstraints = {
        video: {
          deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
          facingMode: selectedDeviceId ? undefined : { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          focusMode: { ideal: 'continuous' },
        } as any,
      };

      await reader.decodeFromConstraints(
        constraints,
        videoRef.current!,
        async (result, error) => {
          if (stoppedRef.current) return;
          if (result) {
            const text = result.getText();
            const shouldStop = await Promise.resolve(onScanRef.current(text));
            // 只有当 onScan 返回 false 以外的值时才停止扫描
            if (shouldStop !== false) {
              stopScanning();
            }
          }
          // 忽略 NotFoundException（正常扫描中未找到二维码）
          if (error && error.name !== 'NotFoundException' && onErrorRef.current) {
            onErrorRef.current(error);
          }
        }
      );

      // decodeFromConstraints 连续模式下 promise 在 reset 后才 resolve
      // 所以 stream/torch 检测不在这里做，而是通过延迟检测
    } catch (error: any) {
      console.error('Scanner error:', error);
      Dialog.alert({ content: t('scannerComponent.cameraStartFailed', { message: error.message }) });
      setIsScanning(false);
    }
  };

  // 延迟检测 stream 和手电筒支持，因为 decodeFromConstraints 连续模式下
  // stream 赋值发生在 zxing 内部，不会触发 promise resolve
  useEffect(() => {
    if (!isScanning) return;
    const timer = setTimeout(() => {
      const video = videoRef.current;
      if (video?.srcObject) {
        const stream = video.srcObject as MediaStream;
        streamRef.current = stream;
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          const capabilities = videoTrack.getCapabilities?.() as any;
          if (capabilities?.torch) {
            setTorchSupported(true);
          }
        }
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [isScanning]);

  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const videoTrack = streamRef.current.getVideoTracks()[0];
    if (!videoTrack) return;

    try {
      const newTorchState = !torchEnabled;
      await videoTrack.applyConstraints({
        advanced: [{ torch: newTorchState } as any]
      });
      setTorchEnabled(newTorchState);
    } catch (error) {
      console.error('Failed to toggle torch:', error);
    }
  };

  const stopScanning = () => {
    stoppedRef.current = true;
    setIsPaused(false);
    setTorchEnabled(false);
    setTorchSupported(false);

    // 从 video 元素直接获取 stream 并停止所有 track
    // 不依赖 streamRef，因为 decodeFromConstraints 连续模式下 streamRef 可能未赋值
    const video = videoRef.current;
    if (video?.srcObject) {
      const stream = video.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      video.srcObject = null;
    }
    streamRef.current = null;

    // 调用 zxing 的 reset
    if (readerRef.current) {
      try {
        readerRef.current.reset();
      } catch (e) {
        // 忽略错误
      }
      readerRef.current = null;
    }

    setIsScanning(false);
  };

  return (
    <div>
      {isPaused ? (
        <PausedPlaceholder>{t('scannerComponent.scanPaused')}</PausedPlaceholder>
      ) : (
        <ScannerContainer>
          <Video ref={videoRef} />
          {isScanning && <Overlay />}
          {isScanning && <Hint>{t('scannerComponent.placeQRInFrame')}</Hint>}
          {isScanning && torchSupported && (
            <TorchButton $active={torchEnabled} onClick={toggleTorch}>
              💡
            </TorchButton>
          )}
        </ScannerContainer>
      )}

      {isScanning && showStopButton && (
        <Button block style={{ marginTop: 12 }} onClick={stopScanning}>
          {t('scannerComponent.stopScan')}
        </Button>
      )}
    </div>
  );
});

Scanner.displayName = 'Scanner';

export default Scanner;