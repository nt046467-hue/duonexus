import React from "react";

interface SparklesSvgProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

/**
 * Real SVG Sparkles icon with crisp 4-pointed radiant diamond star and accent sparks.
 * Replaces generic/outline icon with pure, high-performance SVG.
 */
export function SparklesSvg({
  className = "w-4 h-4",
  size,
  ...props
}: SparklesSvgProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      width={size}
      height={size}
      aria-hidden="true"
      {...props}
    >
      {/* Primary radiant diamond star spark */}
      <path d="M12 2C12 7.52285 7.52285 12 2 12C7.52285 12 12 16.4771 12 22C12 16.4771 16.4771 12 22 12C16.4771 12 12 7.52285 12 2Z" />
      {/* Upper-right secondary shimmer */}
      <path
        d="M18.5 2C18.5 4.48528 16.4853 6.5 14 6.5C16.4853 6.5 18.5 8.51472 18.5 11C18.5 8.51472 20.5147 6.5 23 6.5C20.5147 6.5 18.5 4.48528 18.5 2Z"
        opacity="0.8"
      />
      {/* Lower-left tertiary shimmer */}
      <path
        d="M5 16C5 17.6569 3.65685 19 2 19C3.65685 19 5 20.3431 5 22C5 20.3431 6.34315 19 8 19C6.34315 19 5 17.6569 5 16Z"
        opacity="0.65"
      />
    </svg>
  );
}

/**
 * Single pure radiant diamond spark SVG
 */
export function SingleSparkSvg({
  className = "w-4 h-4",
  size,
  ...props
}: SparklesSvgProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      width={size}
      height={size}
      aria-hidden="true"
      {...props}
    >
      <path d="M12 1.5C12 7.29899 7.29899 12 1.5 12C7.29899 12 12 16.701 12 22.5C12 16.701 16.701 12 22.5 12C16.701 12 12 7.29899 12 1.5Z" />
    </svg>
  );
}

export default SparklesSvg;
