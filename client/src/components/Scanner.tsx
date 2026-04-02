import { useEffect, useRef, useState } from 'react';
import { Button, Dialog } from 'antd-mobile';
import { BrowserMultiFormatReader } from '@zxing/library';
import styled from 'styled-components';

const ScannerContainer = styled.div`
  position: relative;
  width: 100%;
  height: 300px;
  background: #000;
  border-radius: 12px;
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
  border: 2px solid #1677ff;
  border-radius: 12px;
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5);
`;

const Hint = styled.div`
  position: absolute;
  bottom: 20px;
  left: 0;
  right: 0;
  text-align: center;
  color: white;
  font-size: 14px;
`;

interface ScannerProps {
  onScan: (result: string) => boolean | void | Promise<boolean | void>; // 返回 false 表示继续扫描
  onError?: (error: Error) => void;
}

export default function Scanner({ onScan, onError }: ScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const stoppedRef = useRef(false);

  useEffect(() => {
    // 等待 DOM 准备好后再启动扫描
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

      const videoInputDevices = await reader.listVideoInputDevices();
      if (videoInputDevices.length === 0) {
        Dialog.alert({ content: '未找到摄像头设备' });
        return;
      }

      const selectedDeviceId = videoInputDevices[0].deviceId;
      setIsScanning(true);

      reader.decodeFromVideoDevice(
        selectedDeviceId,
        videoRef.current!,
        async (result, error) => {
          if (stoppedRef.current) return;
          if (result) {
            const text = result.getText();
            const shouldStop = await Promise.resolve(onScan(text));
            // 只有当 onScan 返回 false 以外的值时才停止扫描
            if (shouldStop !== false) {
              stopScanning();
            }
          }
          // 忽略 NotFoundException（正常扫描中未找到二维码）
          if (error && error.name !== 'NotFoundException' && onError) {
            onError(error);
          }
        }
      );
    } catch (error: any) {
      console.error('Scanner error:', error);
      Dialog.alert({ content: `启动摄像头失败: ${error.message}` });
      setIsScanning(false);
    }
  };

  const stopScanning = () => {
    stoppedRef.current = true;

    // 手动停止视频流（这是关键，因为 zxing 的 reset 可能不会立即停止）
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }

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
      <ScannerContainer>
        <Video ref={videoRef} />
        {isScanning && <Overlay />}
        {isScanning && <Hint>将二维码放入框内</Hint>}
      </ScannerContainer>

      {isScanning && (
        <Button block style={{ marginTop: 12 }} onClick={stopScanning}>
          停止扫描
        </Button>
      )}
    </div>
  );
}
