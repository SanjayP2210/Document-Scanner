import { useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";
import Tesseract from "tesseract.js";

const videoConstraints = {
    facingMode: "environment",
};

export default function EmiratesIdLiveScanner({ extractEmiratesIdDetails,data,setData }) {
    const webcamRef = useRef(null);
    const canvasRef = useRef(null);
    const scanLockRef = useRef(false);
    const [status, setStatus] = useState("Align Emirates ID inside the frame");
    const [emiratesId, setEmiratesId] = useState("");
    const [preview, setPreview] = useState("");
    const [emiratesData, setEmiratesData] = useState(null);
    console.log('emiratesData', emiratesData);
    useEffect(() => {
        let animationId;

        const scanLoop = async () => {
            if (
                webcamRef.current &&
                webcamRef.current.video &&
                webcamRef.current.video.readyState === 4 &&
                !scanLockRef.current && 
                !data
            ) {
                await autoScan(webcamRef.current.video);
            }

            animationId = setTimeout(scanLoop, 2500);
        };

        scanLoop();

        return () => clearTimeout(animationId);
    }, []);

    /* ---------------- FRAME CAPTURE ---------------- */
    const autoScan = async (video) => {
        try {
            scanLockRef.current = true;
            setStatus("Scanning…");

            const canvas = canvasRef.current;
            const ctx = canvas.getContext("2d");

            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            const blob = await cropAndEnhance(canvas);

            if (blob) {
                await runOCR(blob);
            }

        } catch (err) {
            console.log("AutoScan error:", err);
            scanLockRef.current = false;
        }
    };

    /* ---------------- CROP BASED ON FRAME RATIO ---------------- */
    const cropAndEnhance = (sourceCanvas) => {
        return new Promise((resolve) => {
            const { width, height } = sourceCanvas;

            const cropWidth = width * 0.85;
            const cropHeight = cropWidth / 1.585;

            const x = (width - cropWidth) / 2;
            const y = (height - cropHeight) / 2;

            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");

            canvas.width = cropWidth;
            canvas.height = cropHeight;

            ctx.drawImage(
                sourceCanvas,
                x,
                y,
                cropWidth,
                cropHeight,
                0,
                0,
                cropWidth,
                cropHeight
            );

            enhanceImage(ctx, cropWidth, cropHeight);

            canvas.toBlob(resolve, "image/jpeg", 1);
        });
    };

    /* ---------------- IMAGE PREPROCESS ---------------- */
    const enhanceImage = (ctx, w, h) => {
        const imgData = ctx.getImageData(0, 0, w, h);
        const d = imgData.data;

        for (let i = 0; i < d.length; i += 4) {
            const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
            const val = gray > 140 ? 255 : 0;
            d[i] = d[i + 1] = d[i + 2] = val;
        }

        ctx.putImageData(imgData, 0, 0);
    };

    /* ---------------- OCR ---------------- */
    const runOCR = async (blob) => {
        try {
            const { data } = await Tesseract.recognize(blob, "eng", {
                tessedit_char_whitelist:
                    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-/: ",
            });

            const text = data.text;
            console.log("OCR TEXT:", text);

            const match = text.match(/784-\d{4}-\d{7}-\d/);

            if (match) {
                const details = extractEmiratesIdDetails(text);
                setEmiratesData(details);
                setEmiratesId(match[0]);
                setStatus("Scan complete ✅");

                scanLockRef.current = true; // stop scanning
            } else {
                setStatus("Searching for Emirates ID...");
                scanLockRef.current = false; // allow next interval scan
            }

        } catch (e) {
            console.log("OCR error:", e);
            setStatus("Scan failed, retrying…");
            scanLockRef.current = false;
        }
    };

    /* ---------------- MANUAL RETRY (PRO UX) ---------------- */
    const resetScan = () => {
        scanLockRef.current = false;
        setEmiratesId("");
        setPreview("");
        setStatus("Align Emirates ID inside the frame");
        setData(null);
    };

    return (
        <div className="scanner-wrapper">
            <div className="scanner-box">

                {!emiratesId && <div className="scanner-container">
                    <Webcam
                        ref={webcamRef}
                        audio={false}
                        videoConstraints={videoConstraints}
                        className="camera"
                    />

                    {/* GREEN FRAME */}
                    <div className="card-frame">
                        <div className="scan-line" />
                    </div>
                </div>}

                <p className="hint-text">{status}</p>

                {/* {preview && (
        <div className="preview-box">
          <img src={preview} alt="Preview" />
        </div>
      )} */}

                {emiratesId && (
                    <div className="result-box">
                        <h3 style={{color:'black'}}>Emirates ID</h3>
                        <p className="id-text">{emiratesId}</p>

                        <button onClick={resetScan} className="retry-btn">
                            Scan Again
                        </button>
                    </div>
                )}
                {/* Hidden canvas */}
                <canvas ref={canvasRef} style={{ display: "none" }} />

            </div>
        </div>
    );
}