"use client"

import React from "react"

interface CetingIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string
  className?: string
  variant?: "default" | "minimal" | "badge"
}

export function CetingIcon({
  size = 24,
  className = "",
  variant = "default",
  ...props
}: CetingIconProps) {
  if (variant === "badge") {
    return (
      <div
        className={`inline-flex items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500/20 via-orange-500/10 to-amber-700/20 p-2.5 border border-amber-500/30 shadow-lg shadow-amber-500/10 ${className}`}
        style={{ width: typeof size === "number" ? size * 1.6 : size, height: typeof size === "number" ? size * 1.6 : size }}
      >
        <CetingIcon size={size} variant="default" {...props} />
      </div>
    )
  }

  if (variant === "minimal") {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="currentColor"
        className={className}
        {...props}
      >
        {/* Simplified Vector for small / monochrome contexts */}
        {/* Top Loop */}
        <circle cx="12" cy="3" r="1.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
        {/* Lid */}
        <path
          d="M 4 7.5 C 5 5 8 4 12 4 C 16 4 19 5 20 7.5 L 20 9 C 20 9.5 19.5 10 19 10 L 5 10 C 4.5 10 4 9.5 4 9 Z"
          fill="currentColor"
          opacity="0.9"
        />
        {/* Yellow Accent Rim */}
        <rect x="3" y="10.5" width="18" height="2" rx="0.8" fill="#eab308" />
        {/* Woven Bowl Body */}
        <path
          d="M 3.5 11.5 C 3.8 16 7 18.5 10 19 L 14 19 C 17 18.5 20.2 16 20.5 11.5 Z"
          fill="currentColor"
          opacity="0.8"
        />
        {/* Pedestal Base */}
        <path
          d="M 8.5 19 L 15.5 19 L 15 22 C 15 22.5 14.5 23 14 23 L 10 23 C 9.5 23 9 22.5 9 22 Z"
          fill="currentColor"
          opacity="0.65"
        />
      </svg>
    )
  }

  // Detailed Full Color Vector Illustration
  const idPrefix = React.useId().replace(/:/g, "_")

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 120 120"
      width={size}
      height={size}
      fill="none"
      className={className}
      {...props}
    >
      <defs>
        {/* Shadow */}
        <radialGradient id={`${idPrefix}-shadow`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#000000" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </radialGradient>

        {/* Lid Gradient */}
        <linearGradient id={`${idPrefix}-lidGrad`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#dfb27e" />
          <stop offset="40%" stopColor="#c89f6b" />
          <stop offset="75%" stopColor="#b27f46" />
          <stop offset="100%" stopColor="#8d5b27" />
        </linearGradient>

        {/* Lid Rim Gradient */}
        <linearGradient id={`${idPrefix}-lidRimGrad`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#cda572" />
          <stop offset="50%" stopColor="#a97641" />
          <stop offset="100%" stopColor="#7a481b" />
        </linearGradient>

        {/* Bowl Body Gradient */}
        <linearGradient id={`${idPrefix}-bodyGrad`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#c9975b" />
          <stop offset="40%" stopColor="#b37f44" />
          <stop offset="80%" stopColor="#8f5923" />
          <stop offset="100%" stopColor="#67390e" />
        </linearGradient>

        {/* Body Shading Overlay */}
        <radialGradient id={`${idPrefix}-bodyShade`} cx="50%" cy="25%" r="70%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.2" />
          <stop offset="60%" stopColor="#000000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.45" />
        </radialGradient>

        {/* Base Pedestal Gradient */}
        <linearGradient id={`${idPrefix}-baseGrad`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#8b5726" />
          <stop offset="50%" stopColor="#a77038" />
          <stop offset="100%" stopColor="#62370f" />
        </linearGradient>

        {/* Yellow Rattan Band Gradient */}
        <linearGradient id={`${idPrefix}-yellowBandGrad`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fde047" />
          <stop offset="45%" stopColor="#eab308" />
          <stop offset="100%" stopColor="#ca8a04" />
        </linearGradient>

        {/* Woven Basket Pattern */}
        <pattern id={`${idPrefix}-weave`} width="12" height="12" patternUnits="userSpaceOnUse">
          <path d="M0 6 L6 0 L12 6 L6 12 Z" fill="none" stroke="#683d14" strokeWidth="0.8" opacity="0.38" />
          <path d="M0 0 L12 12 M12 0 L0 12" fill="none" stroke="#ffe0a3" strokeWidth="0.75" opacity="0.32" />
          <path d="M3 3 L9 9 M9 3 L3 9" fill="none" stroke="#4a2405" strokeWidth="0.6" opacity="0.28" />
        </pattern>

        {/* Lid Weave Pattern */}
        <pattern id={`${idPrefix}-lidWeave`} width="10" height="10" patternUnits="userSpaceOnUse">
          <path d="M0 5 L5 0 L10 5 L5 10 Z" fill="none" stroke="#522b08" strokeWidth="0.7" opacity="0.35" />
          <path d="M0 0 L10 10 M10 0 L0 10" fill="none" stroke="#fef0cd" strokeWidth="0.7" opacity="0.3" />
        </pattern>
      </defs>

      {/* Ground Shadow */}
      <ellipse cx="60" cy="107" rx="42" ry="7" fill={`url(#${idPrefix}-shadow)`} />

      {/* Base Pedestal (Kaki Ceting) */}
      <path
        d="M 40 85 L 80 85 L 77 103 C 77 104.5 75.5 105.5 73.5 105.5 L 46.5 105.5 C 44.5 105.5 43 104.5 43 103 Z"
        fill={`url(#${idPrefix}-baseGrad)`}
      />
      <ellipse cx="60" cy="104.5" rx="14.5" ry="2" fill="#522908" />

      {/* Base Yellow Ties */}
      <path
        d="M 46 86 L 50 86 L 50 105 L 46 104.5 Z"
        fill={`url(#${idPrefix}-yellowBandGrad)`}
        stroke="#a16207"
        strokeWidth="0.5"
      />
      <line x1="48" y1="86" x2="48" y2="105" stroke="#fef08a" strokeWidth="0.75" />
      <path
        d="M 72 90 C 74 90 75 92 75 95 C 75 97 73 98 72 97 Z"
        fill="#eab308"
        stroke="#854d0e"
        strokeWidth="0.5"
      />

      {/* Woven Bowl Body */}
      <path
        d="M 17 52 C 17 52 23 83 40 87 C 48 89 72 89 80 87 C 97 83 103 52 103 52 Z"
        fill={`url(#${idPrefix}-bodyGrad)`}
      />
      <path
        d="M 17 52 C 17 52 23 83 40 87 C 48 89 72 89 80 87 C 97 83 103 52 103 52 Z"
        fill={`url(#${idPrefix}-weave)`}
      />
      <path
        d="M 17 52 C 17 52 23 83 40 87 C 48 89 72 89 80 87 C 97 83 103 52 103 52 Z"
        fill={`url(#${idPrefix}-bodyShade)`}
      />

      {/* Structural Weave Curves */}
      <path d="M 23 56 Q 35 72 44 86" stroke="#452005" strokeWidth="0.8" opacity="0.45" fill="none" />
      <path d="M 33 55 Q 43 72 50 87" stroke="#452005" strokeWidth="0.8" opacity="0.38" fill="none" />
      <path d="M 45 55 Q 52 72 57 87" stroke="#452005" strokeWidth="0.8" opacity="0.3" fill="none" />
      <path d="M 75 55 Q 68 72 63 87" stroke="#452005" strokeWidth="0.8" opacity="0.3" fill="none" />
      <path d="M 87 55 Q 77 72 70 87" stroke="#452005" strokeWidth="0.8" opacity="0.38" fill="none" />
      <path d="M 97 56 Q 85 72 76 86" stroke="#452005" strokeWidth="0.8" opacity="0.45" fill="none" />

      {/* Yellow Woven Rim Band */}
      <rect x="14" y="47" width="92" height="8.5" rx="4.25" fill="#4a2505" />
      <g fill={`url(#${idPrefix}-yellowBandGrad)`} stroke="#854d0e" strokeWidth="0.35">
        {[16, 19.5, 23, 26.5, 30, 33.5, 37, 40.5, 44, 47.5, 51, 54.5, 58, 61.5, 65, 68.5, 72, 75.5, 79, 82.5, 86, 89.5, 93, 96.5, 100].map((x) => (
          <rect key={x} x={x} y="47" width="2" height="8.5" rx="0.5" />
        ))}
      </g>
      <line x1="16" y1="48" x2="102" y2="48" stroke="#fef08a" strokeWidth="0.8" opacity="0.75" />

      {/* Side String Accent */}
      <path d="M 14 50 C 9 48 7 42 12 40" stroke="#d97706" strokeWidth="1.2" strokeLinecap="round" fill="none" />

      {/* Lid (Tutup Ceting) */}
      <ellipse cx="60" cy="46" rx="43" ry="4" fill="#000000" opacity="0.3" />
      <rect
        x="15"
        y="32"
        width="90"
        height="13"
        rx="5"
        fill={`url(#${idPrefix}-lidRimGrad)`}
        stroke="#57300c"
        strokeWidth="0.6"
      />
      <line x1="18" y1="35" x2="102" y2="35" stroke="#fde68a" strokeWidth="0.8" opacity="0.5" />
      <line x1="18" y1="43" x2="102" y2="43" stroke="#3b1d06" strokeWidth="0.8" opacity="0.6" />

      {/* Lid Yellow Stitch Joint */}
      <rect
        x="76"
        y="32"
        width="3.5"
        height="13"
        rx="0.5"
        fill={`url(#${idPrefix}-yellowBandGrad)`}
        stroke="#854d0e"
        strokeWidth="0.3"
      />

      {/* Lid Dome */}
      <path d="M 16 34 C 16 34 26 21 60 21 C 94 21 104 34 104 34 Z" fill={`url(#${idPrefix}-lidGrad)`} />
      <path d="M 16 34 C 16 34 26 21 60 21 C 94 21 104 34 104 34 Z" fill={`url(#${idPrefix}-lidWeave)`} />
      <path
        d="M 22 33 C 30 23 58 23 60 23 C 62 23 90 23 98 33"
        stroke="#fff"
        strokeWidth="1"
        opacity="0.25"
        fill="none"
      />

      {/* Top Handle Ring */}
      <ellipse cx="60" cy="21.5" rx="3.5" ry="1.2" fill="#3a1b04" opacity="0.6" />
      <circle cx="60" cy="16" r="4.5" fill={`url(#${idPrefix}-baseGrad)`} stroke="#4a2505" strokeWidth="0.75" />
      <circle cx="60" cy="16" r="2.2" fill="#fdf6e7" stroke="#4a2505" strokeWidth="0.5" />
      <rect x="58.8" y="19" width="2.4" height="3" rx="0.6" fill="#facc15" stroke="#854d0e" strokeWidth="0.3" />
    </svg>
  )
}
