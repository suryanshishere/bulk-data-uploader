// src/hooks/useUploader.ts

import { useRouter } from "next/navigation";
import { Action } from "../lib/uploaderState";

export function useUploader(dispatch: React.Dispatch<Action>) {
  const router = useRouter();

  const uploadFile = (file: File, email: string) => {
    const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
    if (!BACKEND_URL) {
      return dispatch({ type: "UPLOAD_FAILURE", payload: "Backend URL is not configured." });
    }

    dispatch({ type: "START_UPLOAD" });

    const formData = new FormData();
    formData.append("file", file);
    formData.append("email", email);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${BACKEND_URL}/api/upload`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        dispatch({ type: "SET_UPLOAD_PROGRESS", payload: percent });
      }
    };

    xhr.onload = () => {
      if (xhr.status === 200) {
        dispatch({ type: "UPLOAD_SUCCESS" });
        // Refresh server-side props or re-fetch data
        router.refresh();
      } else {
        const errorMsg = xhr.responseText || `Upload failed with status ${xhr.status}`;
        dispatch({ type: "UPLOAD_FAILURE", payload: errorMsg });
      }
    };

    xhr.onerror = () => {
      dispatch({ type: "UPLOAD_FAILURE", payload: "A network error occurred during the upload." });
    };

    xhr.send(formData);
  };

  return { uploadFile };
}