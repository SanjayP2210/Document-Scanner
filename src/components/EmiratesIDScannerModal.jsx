import React, { useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";
import { Button, Container, Modal, ModalBody, ModalHeader } from "reactstrap";
import { createWorker } from "tesseract.js";
import { CameraError } from "../Camera/CameraError";
import CameraLoader from "../Camera/CameraLoader";
import { IconCircleX, IconCircleXFilled, IconRotateClockwise } from "@tabler/icons-react";

export default function EmiratesIDScannerModal({
  modalOpen,
  setModalOpen,
  onExtracted,
}) {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const workerRef = useRef(null);
  const intervalRef = useRef(null);
  const scannerRef = useRef(null);
  const [webcamKey, setWebcamKey] = useState(0);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [cardDetected, setCardDetected] = useState(false);
  const [flash, setFlash] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [isAligned, setIsAligned] = useState(false);
  const [guideMessage, setGuideMessage] = useState(
    "Place your Emirates ID inside the frame",
  );
  const [isBackCamera, setIsBackCamera] = useState(true);
  // 🔥 CAMERA STATES
  const [videoDevices, setVideoDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [isSwitching, setIsSwitching] = useState(false);
  const [fade, setFade] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  // -----------------------------
  // INIT OCR WORKER
  // -----------------------------
  const initWorker = async () => {
    const worker = await createWorker("eng");
    await worker.setParameters({
      tessedit_char_whitelist:
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-/: ",
    });
    workerRef.current = worker;
  };

  // -----------------------------
  // DETECT CAMERAS
  // -----------------------------
  const detectAvailableCameras = async () => {
    try {
      // Ask permission minimally
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1920, height: 1080 },
      });
      stream.getTracks().forEach((track) => track.stop());
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter(
        (device) => device.kind === "videoinput",
      );
      if (!videoInputs.length) {
        setCameraError("No camera devices found.");
        return;
      }
      setVideoDevices(videoInputs);
      const backCamera =
        videoInputs.find((d) => d.label.toLowerCase().includes("back")) ||
        videoInputs[0];
      setSelectedDeviceId(backCamera.deviceId);
      // 🔥 Force fresh mount
      setWebcamKey((prev) => prev + 1);
    } catch (error) {
      console.error(error);
      setCameraError("Unable to detect cameras.");
    }
  };
  // -----------------------------
  // SWITCH CAMERA (SMOOTH)
  // -----------------------------
  const handleSwitchCamera = () => {
    if (!videoDevices.length) return;
    setFade(true);
    setCameraReady(false);
    setShowScanner(false);
    setIsSwitching(true);
    const currentIndex = videoDevices.findIndex(
      (device) => device.deviceId === selectedDeviceId,
    );
    const nextIndex = (currentIndex + 1) % videoDevices.length;
    setTimeout(() => {
      setSelectedDeviceId(videoDevices[nextIndex].deviceId);
      // 🔥 Force Webcam re-mount (VERY IMPORTANT)
      setWebcamKey((prev) => prev + 1);
      setFade(false);
      setIsSwitching(false);
      setIsBackCamera((prevState) => !prevState);
    }, 300);
  };
  // -----------------------------
  // RESET
  // -----------------------------
  const handleReset = () => {
    setCardDetected(false);
    setFlash(false);
    setCameraReady(false);
    setShowScanner(false);
    setIsAligned(false);
    setCameraError(null);
    setGuideMessage("Place your Emirates ID inside the frame");
    // if (webcamRef.current?.video?.srcObject) {
    //   webcamRef.current.video.srcObject
    //     .getTracks()
    //     .forEach((track) => track.stop());
    // }
    clearInterval(intervalRef.current);
    if (workerRef.current) {
      workerRef.current.terminate();
    }
  };
  // -----------------------------
  // MODAL EFFECT
  // -----------------------------
  useEffect(() => {
    if (modalOpen) {
      detectAvailableCameras();
    } else {
      handleReset();
    }
  }, [modalOpen]);
  // -----------------------------
  // OCR INTERVAL
  // -----------------------------
  useEffect(() => {
    if (!cameraReady || cardDetected) return;
    intervalRef.current = setInterval(() => {
      captureAndRunOCR();
    }, 1500);
    setTimeout(() => {
      setShowScanner(cameraReady);
    }, 200);
    return () => clearInterval(intervalRef.current);
  }, [cameraReady]);
  
  const handleUserMedia = () => {
    const video = webcamRef.current?.video;
    if (video) {
      console.log("Actual resolution:", video.videoWidth, video.videoHeight);
    }
    setCameraReady(true);
    initWorker();
  };
  const handleUserMediaError = (error) => {
    console.error("Camera Error:", error);
    setCameraReady(false);
    setCameraError("Unable to access camera.");
  };
  // -----------------------------
  // CARD DETECTION
  // -----------------------------
  const checkCardPresence = (imageData) => {
    const pixels = imageData.data;
    let contrastCount = 0;
    for (let i = 0; i < pixels.length; i += 40) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      const brightness = (r + g + b) / 3;
      if (brightness < 70 || brightness > 200) {
        contrastCount++;
      }
    }
    return contrastCount > 250;
  };

  const captureAndRunOCR = async () => {
    if (!webcamRef.current || cardDetected || processing) return;
    if (!scannerRef.current) return;
    setProcessing(true);
    const video = webcamRef.current.video;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    const videoRect = video.getBoundingClientRect();
    const scanRect = scannerRef.current.getBoundingClientRect();
    const scaleX = canvas.width / videoRect.width;
    const scaleY = canvas.height / videoRect.height;
    const cropX = (scanRect.left - videoRect.left) * scaleX;
    const cropY = (scanRect.top - videoRect.top) * scaleY;
    const cropWidth = scanRect.width * scaleX;
    const cropHeight = scanRect.height * scaleY;
    const cropped = ctx.getImageData(cropX, cropY, cropWidth, cropHeight);
    const cardInside = checkCardPresence(cropped);
    if (!cardInside) {
      setGuideMessage("Align card inside the frame");
      setProcessing(false);
      return;
    }
    setGuideMessage("Reading card...");
    canvas.width = cropWidth;
    canvas.height = cropHeight;
    ctx.putImageData(cropped, 0, 0);
    const { data } = await workerRef.current.recognize(canvas);
    const text = data.text;
    console.log("OCR TEXT:", text);
    const idRegex = /784-\d{4}-\d{7}-\d/;
    const dobRegex =
      /\b(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/(19|20)\d{2}\b/;
    const emirateIdMatch = text.match(idRegex);
    const dobMatch = text.match(dobRegex);
    const aadhaarNumberMatch =  text?.match(/\b\d{4}\s?\d{4}\s?\d{4}\b/);
    if (dobMatch && (aadhaarNumberMatch || emirateIdMatch)) {
      setCardDetected(true);
      onExtracted(text);
      setFlash(true);
      setTimeout(() => setFlash(false), 200);
      clearInterval(intervalRef.current);
      workerRef.current.terminate();
    }
    setProcessing(false);
  };

    const isCameraLoadig = !cameraError && (isSwitching || !cameraReady);

  return (
    <Modal
      isOpen={modalOpen}
      toggle={() => setModalOpen(!modalOpen)}
      fullscreen
      contentClassName="camera-modal-content"
      backdrop="static"
    >
      <ModalBody
        style={{ padding: 0, background: "#000", position: "relative" }}
      >
        {/* 🔥 CLOSE BUTTON */}
        <div
          className="camera-modal-close-btn"
        >
          <IconCircleXFilled
            size={40}
            color="white"
            onClick={() => setModalOpen(false)}
          />
        </div>

        {/* 🔥 LOADER */}
          {isCameraLoadig && (
            <div className="emirate-loader">
                {" "}
                <CameraLoader msg={isSwitching ? 'Switching' : 'Initializing'} />
            </div>
        )}
        {cameraError &&
            <div className="emirate-loader">
                {" "}
                <CameraError error={cameraError} />
            </div>
        }

        {/* 🔥 CAMERA WRAPPER */}
        <div
         className="camera-video-container"
          style={{
            height:  isSwitching || !cameraReady ? "0" :  "100dvh",
          }}
        >
          {/* 🔥 WEBCAM */}
          <Webcam
            key={webcamKey}
            ref={webcamRef}
            audio={false}
            screenshotQuality={1}
            videoConstraints={{
              deviceId: selectedDeviceId
                ? { exact: selectedDeviceId }
                : undefined,
              width: { ideal: 1920 },
              height: { ideal: 1080 },
              frameRate: { ideal: 30 },
            }}
            onUserMedia={handleUserMedia}
            onUserMediaError={handleUserMediaError}
            className="camera-video-tag"
            style={{
              opacity: fade ? 0 : 1,
            }}
            mirrored={!isBackCamera}
          />

          {/* 🔥 SCANNER FRAME */}
          {showScanner && (
            <div
              ref={scannerRef}
              className="camera-scanner-frame"
            >
              {/* SCAN LINE */}
              <div
               className="camera-scanner-lines"
              />
            </div>
          )}

          {/* 🔥 FLASH */}
          {flash && (
            <div className="camera-scanner-flash"
            />
          )}

          <canvas ref={canvasRef} style={{ display: "none" }} />

          {/* 🔥 BOTTOM CONTROLS */}
          <div
           className="emirate-guide-message-box"
          >
            {showScanner && (
              <div className="emirate-guide-message">
                {guideMessage}
              </div>
            )}
            {cameraReady && (
              <Button
                color="secondary"
                onClick={handleSwitchCamera}
                disabled={isSwitching}
              >
                <IconRotateClockwise className="me-2" />
                Switch Camera
              </Button>
            )}
          </div>
        </div>
      </ModalBody>
    </Modal>
  );
}
