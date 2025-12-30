"use client";
import React, { useState } from "react";
import { Label } from "../../components/ui/label";
import { Input } from "../../components/ui/input";
import { cn } from "../lib/util";
import { useRouter } from "next/navigation";
import {
  IconBrandGoogle,
  IconMail,
  IconCheck,
  IconX,
  IconShieldCheck,
} from "@tabler/icons-react";
import Link from "next/link";
import { authService } from "../../services/authService";

export function SignupFormDemo() {
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [countdown, setCountdown] = useState(0);
  const router = useRouter();
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    firstname: "",
    lastname: "",
    email: "",
    password: "",
    otp: "",
  });

  // Email validation regex
  const isValidEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSendOTP = async () => {
    if (!formData.email || !isValidEmail(formData.email)) {
      setOtpError("Please enter a valid email address");
      return;
    }

    setOtpSending(true);
    setOtpError("");

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/val/send-otp`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: formData.email,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setOtpError(data.error || "Failed to send OTP");
      }
      setOtpSent(true);
      setCountdown(60);

      // Start countdown timer
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      console.log("OTP sent to:", formData.email);
    } catch (err) {
      setOtpError("Failed to send OTP. Please try again.");
      console.error("OTP send error:", err);
    } finally {
      setOtpSending(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!formData.otp || formData.otp.length !== 6) {
      setOtpError("Please enter a valid 6-digit OTP");
      return;
    }

    setOtpError("");

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/val/verify-otp`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: formData.email,
            otp: formData.otp,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setOtpError(data.error || "Failed to verify OTP");
      }

      setOtpVerified(true);
      setOtpError("");
      console.log("OTP verified:", formData.otp);
    } catch (err) {
      setOtpError("Invalid OTP. Please try again.");
      console.error("OTP verification error:", err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!otpVerified) {
      setError("Please verify your email with OTP first");
      return;
    }

    setLoading(true);
    setSuccess("");
    setError("");

    try {
      const data = await authService.register(formData);

      if (data.success) {
        setSuccess(
          data.message || "Registration successful! Redirecting to login..."
        );

        setTimeout(() => {
          router.push("/Login");
        }, 2000);
      } else {
        setError(data.message || "Registration failed");
      }
    } catch (err) {
      setError(err.message || "Network error. Please try again.");
      console.error("Registration error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    // For OTP field, only allow numbers and max 6 digits
    if (name === "otp") {
      const numericValue = value.replace(/[^0-9]/g, "").slice(0, 6);
      setFormData({
        ...formData,
        [name]: numericValue,
      });
    } else {
      setFormData({
        ...formData,
        [name]: value,
      });
    }

    // Reset OTP sent status if email changes
    if (name === "email" && otpSent) {
      setOtpSent(false);
      setOtpVerified(false);
      setFormData((prev) => ({ ...prev, otp: "" }));
      setCountdown(0);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-8 px-4 sm:px-6 lg:px-8">
      {/* Home Button */}
      <Link
        href="/"
        className="fixed top-4 left-4 z-50 px-4 py-2 bg-white/10 backdrop-blur-sm text-white rounded-lg hover:bg-white/20 transition-all duration-200 text-sm font-medium border border-white/20 shadow-lg"
      >
        ← HOME
      </Link>

      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mb-4 shadow-xl">
            <IconShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-2">
            Create Account
          </h2>
          <p className="text-gray-300 text-sm sm:text-base">
            Join us and start collaborating today
          </p>
        </div>

        {/* Form Container */}
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 sm:p-8 border border-white/20 shadow-2xl">
          <form className="space-y-5" onSubmit={handleSubmit}>
            {/* Name Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <LabelInputContainer>
                <Label htmlFor="firstname" className="text-gray-200">
                  First Name <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="firstname"
                  name="firstname"
                  type="text"
                  placeholder="John"
                  value={formData.firstname}
                  onChange={handleChange}
                  required
                  className="bg-white/5 border-white/20 text-white placeholder:text-gray-400 focus:border-blue-400 focus:ring-blue-400/20"
                />
              </LabelInputContainer>

              <LabelInputContainer>
                <Label htmlFor="lastname" className="text-gray-200">
                  Last Name
                </Label>
                <Input
                  id="lastname"
                  name="lastname"
                  type="text"
                  placeholder="Doe"
                  value={formData.lastname}
                  onChange={handleChange}
                  className="bg-white/5 border-white/20 text-white placeholder:text-gray-400 focus:border-blue-400 focus:ring-blue-400/20"
                />
              </LabelInputContainer>
            </div>

            {/* Email Field with Send OTP */}
            <LabelInputContainer>
              <Label htmlFor="email" className="text-gray-200">
                Email Address <span className="text-red-400">*</span>
              </Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="email"
                    name="email"
                    placeholder="you@example.com"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    disabled={otpVerified}
                    className={cn(
                      "bg-white/5 border-white/20 text-white placeholder:text-gray-400 focus:border-blue-400 focus:ring-blue-400/20 pr-10",
                      otpVerified &&
                        "bg-green-500/10 border-green-500/50 text-green-100"
                    )}
                  />
                  {otpVerified && (
                    <IconCheck className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-400" />
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleSendOTP}
                  disabled={
                    !formData.email ||
                    !isValidEmail(formData.email) ||
                    otpSending ||
                    countdown > 0 ||
                    otpVerified
                  }
                  className={cn(
                    "px-4 py-2 rounded-lg font-medium text-sm transition-all whitespace-nowrap flex items-center gap-2 min-w-[100px] justify-center",
                    otpVerified
                      ? "bg-green-500/20 text-green-300 cursor-not-allowed border border-green-500/30"
                      : countdown > 0
                      ? "bg-gray-500/20 text-gray-300 cursor-not-allowed border border-gray-500/30"
                      : !formData.email || !isValidEmail(formData.email)
                      ? "bg-gray-500/20 text-gray-400 cursor-not-allowed border border-gray-500/30"
                      : "bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl border border-blue-500"
                  )}
                >
                  {otpVerified ? (
                    <>
                      <IconCheck className="w-4 h-4" />
                      <span className="hidden sm:inline">Verified</span>
                    </>
                  ) : otpSending ? (
                    <>
                      <svg
                        className="animate-spin h-4 w-4"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      <span className="hidden sm:inline">Sending</span>
                    </>
                  ) : countdown > 0 ? (
                    <span className="font-mono">{countdown}s</span>
                  ) : otpSent ? (
                    <>
                      <IconMail className="w-4 h-4" />
                      <span className="hidden sm:inline">Resend</span>
                    </>
                  ) : (
                    <>
                      <IconMail className="w-4 h-4" />
                      <span className="hidden sm:inline">Send OTP</span>
                    </>
                  )}
                </button>
              </div>
            </LabelInputContainer>

            {/* OTP Input Field */}
            {otpSent && !otpVerified && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-center gap-2 text-blue-300 text-sm">
                  <IconMail className="w-4 h-4" />
                  <span>OTP sent to {formData.email}</span>
                </div>
                <LabelInputContainer>
                  <Label htmlFor="otp" className="text-gray-200">
                    Enter 6-Digit OTP
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="otp"
                      name="otp"
                      placeholder="000000"
                      type="text"
                      inputMode="numeric"
                      value={formData.otp}
                      onChange={handleChange}
                      maxLength={6}
                      className="flex-1 text-center text-xl tracking-[0.5em] font-bold bg-white/5 border-white/20 text-white placeholder:text-gray-500 focus:border-blue-400 focus:ring-blue-400/20"
                    />
                    <button
                      type="button"
                      onClick={handleVerifyOTP}
                      disabled={formData.otp.length !== 6}
                      className={cn(
                        "px-6 py-2 rounded-lg font-medium text-sm transition-all whitespace-nowrap",
                        formData.otp.length === 6
                          ? "bg-green-600 hover:bg-green-700 text-white shadow-lg hover:shadow-xl"
                          : "bg-gray-500/20 text-gray-400 cursor-not-allowed border border-gray-500/30"
                      )}
                    >
                      Verify
                    </button>
                  </div>
                </LabelInputContainer>
              </div>
            )}

            {/* Verified Success Message */}
            {otpVerified && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex-shrink-0 w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
                  <IconCheck className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <p className="text-green-300 font-medium text-sm">
                    Email Verified!
                  </p>
                  <p className="text-green-400/70 text-xs">
                    You can now complete your registration
                  </p>
                </div>
              </div>
            )}

            {/* OTP Error Message */}
            {otpError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                <IconX className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-red-300 text-sm">{otpError}</p>
              </div>
            )}

            {/* Password Field */}
            <LabelInputContainer>
              <Label htmlFor="password" className="text-gray-200">
                Password <span className="text-red-400">*</span>
              </Label>
              <Input
                id="password"
                name="password"
                placeholder="Create a strong password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                required
                className="bg-white/5 border-white/20 text-white placeholder:text-gray-400 focus:border-blue-400 focus:ring-blue-400/20"
              />
              <p className="text-xs text-gray-400 mt-1">
                Must be at least 8 characters long
              </p>
            </LabelInputContainer>

            {/* General Error Message */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                <IconX className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                <IconCheck className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <p className="text-green-300 text-sm">{success}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              className={cn(
                "relative w-full h-12 rounded-lg font-semibold text-white transition-all duration-200 overflow-hidden group",
                loading || !otpVerified || !!success
                  ? "bg-gray-500/30 cursor-not-allowed"
                  : "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg hover:shadow-xl"
              )}
              type="submit"
              disabled={loading || !!success || !otpVerified}
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                {loading ? (
                  <>
                    <svg
                      className="animate-spin h-5 w-5"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Creating Account...
                  </>
                ) : (
                  <>
                    Sign Up
                    <span className="group-hover:translate-x-1 transition-transform">
                      →
                    </span>
                  </>
                )}
              </span>
              {!loading && !otpVerified && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
              )}
            </button>

            {/* Divider */}
            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/20"></div>
              </div>
              <div className="relative flex justify-center">
                <span className="px-4 bg-transparent text-gray-400 text-sm">
                  Or continue with
                </span>
              </div>
            </div>

            {/* Social Login */}
            <button
              className="w-full h-11 flex items-center justify-center gap-3 bg-white/5 hover:bg-white/10 border border-white/20 rounded-lg font-medium text-white transition-all duration-200 group"
              type="button"
            >
              <IconBrandGoogle className="w-5 h-5 group-hover:scale-110 transition-transform" />
              <span>Continue with Google</span>
            </button>

            {/* Login Link */}
            <div className="text-center pt-4">
              <p className="text-gray-300 text-sm">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => router.push("/Login")}
                  className="text-blue-400 hover:text-blue-300 font-semibold hover:underline transition-colors"
                >
                  Log in
                </button>
              </p>
            </div>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-400 text-xs mt-6">
          By signing up, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}

const LabelInputContainer = ({ children, className }) => {
  return (
    <div className={cn("flex w-full flex-col space-y-2", className)}>
      {children}
    </div>
  );
};
