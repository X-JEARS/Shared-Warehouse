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
  onScan: (result: string) => void;
  onError?: (error: Error) => void;
}

export default function Scanner({ onScan, onError }: ScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);

  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, []);

  const startScanning = async () => {
    try {
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
        (result, error) => {
          if (result) {
            const text = result.getText();
            onScan(text);
            stopScanning();
          }
          if (error && onError) {
            onError(error);
          }
        }
      );
    } catch (error: any) {
      console.error('Scanner error:', error);
      Dialog.alert({ content: `启动摄像头失败: ${error.message}` });
    }
  };

  const stopScanning = () => {
    if (readerRef.current) {
      readerRef.current.reset();
      readerRef.current = null;
    }
    setIsScanning(false);
  };

  return (
    <div>
      <ScannerContainer>
        <Video ref={videoRef} />
        {isScanning && <Overlay />}
        {!isScanning && (
          <Hint>
            <Button color="primary" onClick={startScanning}>
              点击开始扫描
            </Button>
          </Hint>
        )}
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
