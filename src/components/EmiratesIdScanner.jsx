import { useRef, useState } from "react";
import Tesseract from "tesseract.js";
import EmiratesIdLiveScanner from "./EmiratesIdLiveScanner";

export default function EmiratesIdScanner() {
    const webcamRef = useRef(null);
    const fileInputRef = useRef(null);

    const [mode, setMode] = useState(null); // upload | camera
    const [preview, setPreview] = useState("");
    const [status, setStatus] = useState("");
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);

    /* ---------------- MODE SWITCH ---------------- */
    const openUpload = () => {
        reset();
        setMode("upload");
        fileInputRef.current.click();
    };

    const openCamera = () => {
        reset();
        setMode("camera");
    };

    /* ---------------- FILE UPLOAD ---------------- */
    const handleUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setPreview(URL.createObjectURL(file));
        processImage(file);
    };

    /* ---------------- CAMERA CAPTURE ---------------- */
    const captureImage = async () => {
        const imageSrc = webcamRef.current.getScreenshot();
        if (!imageSrc) return;

        setPreview(imageSrc);
        const blob = await fetch(imageSrc).then((r) => r.blob());
        processImage(blob);
    };

    /* ---------------- COMMON PROCESSING ---------------- */
    const processImage = async (fileOrBlob) => {
        setLoading(true);
        setStatus("Reading Emirates ID...");
        setData(null);

        const processedBlob = await preprocessImage(fileOrBlob);
        runOCR(processedBlob);
    };

    /* ---------------- IMAGE PREPROCESS ---------------- */
    const preprocessImage = (file) => {
        return new Promise((resolve) => {
            const img = new Image();
            img.src = URL.createObjectURL(file);

            img.onload = () => {
                const canvas = document.createElement("canvas");
                const ctx = canvas.getContext("2d");

                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);

                const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const d = imgData.data;

                for (let i = 0; i < d.length; i += 4) {
                    const gray =
                        0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
                    const val = gray > 140 ? 255 : 0;
                    d[i] = d[i + 1] = d[i + 2] = val;
                }

                ctx.putImageData(imgData, 0, 0);
                canvas.toBlob(resolve, "image/jpeg", 1);
            };
        });
    };

    /* ---------------- OCR + DATA EXTRACTION ---------------- */
    const runOCR = async (blob) => {
        try {
            const { data } = await Tesseract.recognize(blob, "eng", {
                tessedit_char_whitelist:
                    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-/: ",
            });

            const extracted = extractEmiratesIdDetails(data.text);
            setStatus("Scan complete");
        } catch (e) {
            console.error(e);
            setStatus("Failed to read Emirates ID");
        } finally {
            setLoading(false);
        }
    };

    /* ---------------- TEXT PARSER ---------------- */
    const extractEmiratesIdDetails = (text) => {
        // Normalize text
        const cleanText = text.replace(/\r/g, "");
        console.log('cleanText', cleanText);
        const getLineValue = (label) => {
            const regex = new RegExp(`${label}\\s*:\\s*(.*)`, "i");
            const match = cleanText.match(regex);
            return match ? match[1].split("\n")[0].trim() : "";
        };

        const cleanName = (value) =>
            value
                .replace(/[^A-Za-z\s]/g, " ")   // remove ~~ N N etc
                .replace(/\s+/g, " ")
                .trim();

        const details = {
            emiratesIdNumber:
                cleanText.match(/784-\d{4}-\d{7}-\d/)?.[0] || "",

            name: cleanText.match(/name\s*:\s*(.*)/i)?.[1] || "",
            // cleanName(getLineValue("Name")),

            dateOfBirth:
                cleanText.match(/Date of Birth\s*:\s*(\d{2}\/\d{2}\/\d{4})/i)?.[1] || "",

            nationality: cleanName(getLineValue("Nationality")),
        };
        setData(details);
        return details;
    };


    /* ---------------- RESET ---------------- */
    const reset = () => {
        setPreview("");
        setStatus("");
        setData(null);
        setLoading(false);
    };

    return (
        <div className="app-wrapper">
            <div className="scanner-card">
                <h2 className="title">Document Scanner</h2>

                <div className="action-buttons">
                    <button onClick={openUpload} className="btn warning">
                        📂 Upload
                    </button>
                    <button onClick={openCamera} className="btn primary">
                        📷 Capture
                    </button>
                </div>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={handleUpload}
                />

                {/* {mode === "camera" && <> <Webcam 
                        ref={webcamRef}
                        audio={false}
                        screenshotFormat="image/jpeg"
                        style={{ width: "100%", borderRadius: 8 }}
                    />
                    <button onClick={captureImage} style={{ marginTop: 10 }}>
                        Capture Image
                    </button> 
                    </>
                } */}
                {mode === "camera" &&  <EmiratesIdLiveScanner 
                    extractEmiratesIdDetails={extractEmiratesIdDetails}
                    data={data}
                    setData={setData}
                />}

                {/* {preview && (
                    <div className="preview-box">
                        <img src={preview} alt="Preview" />
                    </div>
                )} */}

                {status && <p className="status">{status}</p>}

                {data && (
                    <div className="result-card">
                        <h3>Extracted Details</h3>
                        <p><b>Emirates ID:</b> {data.emiratesIdNumber || "Not found"}</p>
                        <p><b>Name:</b> {data.name || "Not found"}</p>
                        <p><b>Nationality:</b> {data.nationality || "Not found"}</p>
                        <p><b>DOB:</b> {data.dateOfBirth || "Not found"}</p>
                    </div>
                )}

                {loading && <p className="loading">Processing…</p>}
            </div>
        </div>
    );
}
