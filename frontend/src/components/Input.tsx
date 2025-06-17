import React, { CSSProperties, forwardRef, ChangeEvent } from "react";
import { startCase } from "lodash";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  name: string;
  label?: string | boolean;
  placeholder?: string;
  required?: boolean;
  style?: CSSProperties;
  row?: number;
  value?: string | number;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  error?: boolean;
  helperText?: string;
  disabled?: boolean;
  type?: string;
  className?: string;
  outerClassProp?: string;
  errorClassProp?: string;
  maxHeight?: number;
  autoComplete?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      name,
      label,
      placeholder,
      required,
      type,
      style,
      value,
      onChange,
      error,
      helperText,
      className,
      outerClassProp,
      errorClassProp,
      autoComplete,
      ...rest
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = React.useState<boolean>(false);
    const errorId = helperText && error ? `${name}-error` : undefined;

    const togglePasswordVisibility = () => {
      setShowPassword((prevShowPassword) => !prevShowPassword);
    };

    const endAdornment = (() => {
      if (type === "password") {
        return (
          <button
            type="button"
            className="p-0 hover:text-custom_red absolute right-2 top-1/2 transform -translate-y-1/2 text-xs text-custom_gray"
            onClick={togglePasswordVisibility}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        );
      } else if (type === "search") {
        return (
          <span className="absolute right-3 top-1/2 transform -translate-y-1/2">
            🔍
          </span>
        );
      }
      return null;
    })();

    return (
      <div className={`relative w-full flex items-center group ${outerClassProp ?? ""}`} role="group">
        {/* Black shadow offset */}
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 bg-black
            transform translate-x-1 translate-y-1
            transition-transform duration-200 ease-out
            ${error ? "opacity-70" : "opacity-50"}
            group-focus-within:translate-x-0 group-focus-within:translate-y-0
            ${error ? "group-focus-within:opacity-80" : ""}
          `}
        />
        {/* White background + border */}
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 bg-white border-2 border-black
            transition-colors duration-200 ease-out
            ${error ? "border-red-600 bg-red-100" : ""} group-focus-within:border-black`}
        />

        {label && (
          <label htmlFor={name} className="block text-sm font-medium mb-1 absolute -top-6 left-0">
            {typeof label === "string" ? startCase(label) : startCase(name)}
          </label>
        )}

        <input
          ref={ref}
          id={name}
          name={name}
          type={showPassword && type === "password" ? "text" : type}
          autoComplete={
            autoComplete ??
            (type === "password"
              ? "current-password"
              : type === "email"
              ? "username"
              : undefined)
          }
          required={required}
          placeholder={placeholder || startCase(name)}
          value={value}
          onChange={onChange}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={errorId}
          className={`relative w-full bg-transparent pl-2 py-2 outline-none text-base rounded
            text-black
            ${error ? "text-red-700" : ""}
            ${className}`}
          style={style}
          {...rest}
        />
        {endAdornment && (
          <div className="absolute right-1 flex items-center h-full">{endAdornment}</div>
        )}
        {helperText && (
          <p
            id={errorId}
            className={`ml-2 mt-[2px] text-xs w-auto whitespace-nowrap ${
              error ? "text-custom_red" : "hidden"
            } ${errorClassProp}`}
          >
            {helperText.replace(/_/g, " ")}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export interface TextAreaProps
  extends Omit<
    React.TextareaHTMLAttributes<HTMLTextAreaElement>,
    "onChange" | "name" | "value" | "rows"
  > {
  name: string;
  label?: string | boolean;
  placeholder?: string;
  required?: boolean;
  style?: CSSProperties;
  row?: number;
  value?: string | number;
  onChange?: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  error?: boolean;
  helperText?: string;
  disabled?: boolean;
  className?: string;
  outerClassProp?: string;
  errorClassProp?: string;
  maxHeight?: number;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  (
    {
      name,
      required,
      value,
      onChange,
      row = 4,
      placeholder,
      disabled = false,
      error,
      helperText,
      className,
      outerClassProp,
      errorClassProp,
      label,
      maxHeight = 300,
      ...rest
    },
    ref
  ) => {
    const textAreaRef = React.useRef<HTMLTextAreaElement | null>(null);
    const [height, setHeight] = React.useState<string>("auto");
    const errorId = helperText && error ? `${name}-error` : undefined;

    React.useEffect(() => {
      if (textAreaRef.current) {
        setHeight("auto"); // Reset before recalculating
        const newHeight = textAreaRef.current.scrollHeight;
        setHeight(`${Math.min(newHeight, maxHeight)}px`); // Limit height
      }
    }, [value, maxHeight]);

    return (
      <div className={`relative group ${outerClassProp || ""}`} role="group">
        {/* Black shadow offset */}
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 bg-black
            transform translate-x-1 translate-y-1
            transition-transform duration-200 ease-out
            ${error ? "opacity-70" : "opacity-50"}
            group-focus-within:translate-x-0 group-focus-within:translate-y-0
            ${error ? "group-focus-within:opacity-80" : ""}
          `}
        />
        {/* White background + border */}
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 bg-white border-2 border-black
            transition-colors duration-200 ease-out
            ${error ? "border-red-600 bg-red-100" : ""} group-focus-within:border-black`}
        />

        {label && (
          <label htmlFor={name} className="block text-sm font-medium mb-1 absolute -top-6 left-0">
            {typeof label === "string" ? startCase(label) : startCase(name)}
          </label>
        )}

        <textarea
          placeholder={placeholder}
          ref={(el) => {
            if (ref) {
              if (typeof ref === "function") ref(el);
              else ref.current = el;
            }
            textAreaRef.current = el;
          }}
          id={name}
          name={name}
          rows={row}
          required={required}
          disabled={disabled}
          value={value}
          onChange={(e) => {
            if (onChange) onChange(e);
            setHeight("auto"); // Reset before recalculating
            const newHeight = e.target.scrollHeight;
            setHeight(`${Math.min(newHeight, maxHeight)}px`); // Limit height
          }}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={errorId}
          className={`relative w-full bg-transparent pl-2 py-2 outline-none text-base rounded
            text-black
            ${error ? "text-red-700" : ""}
            ${className}`}
          style={{
            height,
            maxHeight: `${maxHeight}px`,
            overflowY: height === `${maxHeight}px` ? "auto" : "hidden",
          }}
          {...rest}
        />
        {helperText && (
          <p
            id={errorId}
            className={`ml-2 mt-[2px] text-xs w-auto whitespace-nowrap ${
              error ? "text-custom_red" : "hidden"
            } ${errorClassProp}`}
          >
            {helperText.replace(/_/g, " ")}
          </p>
        )}
      </div>
    );
  }
);

TextArea.displayName = "TextArea";