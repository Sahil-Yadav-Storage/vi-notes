import { useEffect } from "react";

interface ToastProps {
  message: string;
  type?: "success" | "error";
  onClose: () => void;
}

const Toast = ({ message, type = "success", onClose }: ToastProps) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return <div className={`toast ${type}`}>{message}</div>;
};

export default Toast;