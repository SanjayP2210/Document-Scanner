import React from "react";

export const CameraError = ({error}) => {
  return (
    <div className="error-message">
      <p style={{ color: "red" }}>{error}</p>
    </div>
  );
};
