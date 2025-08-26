'use client'
import React from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { cn } from '../lib/util'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const ResetPassword = () => {
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [userEmail, setUserEmail] = useState("") // Dynamic email based on user lookup
    const [otpSent, setOtpSent] = useState(false) // Changed from otp to otpSent for clarity
    const [step, setStep] = useState('username') // 'username', 'otp', or 'newPassword'
    const router = useRouter();

    const [formData, setFormData] = useState({
        username: ""
    });

    const [otpData, setOtpData] = useState({
        otp: ""
    });

    const [newPasswordData, setNewPasswordData] = useState({
        password: "",
        confirmPassword: ""
    });


    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement>
    ) => {
        const { name, value } = e.target;

        if (name === "username") {
            setFormData((prev) => ({
                ...prev,
                [name]: value,
            }));
        } else if (name === "otp") {
            setOtpData((prev) => ({
                ...prev,
                [name]: value,
            }));
        } else if (name === "password" || name === "confirmPassword") {
            setNewPasswordData((prev) => ({
                ...prev,
                [name]: value,
            }));
        }
    };


    // Handle username submission and email lookup
    const handleUsernameSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/reset/Email`, {
                method: "POST",
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: formData.username })
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to find user');
            }
            setUserEmail(data.email);
            setStep('otp');

        } catch (err: unknown) {
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError("Failed to process request");
            }
        } finally {
            setLoading(false);
        }
    };

    // Handle OTP sending
    const handleSendOTP = async (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/reset/send-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: userEmail,
                    username: formData.username
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to send OTP');
            }

            setOtpSent(true);

        } catch (err) {
            setError(err.message || "Failed to send OTP. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    // Handle OTP verification
    const handleOTPSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/reset/verify-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: userEmail,
                    otp: otpData.otp
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to verify OTP');
            }

            setStep('newPassword');

        } catch (err) {
            setError(err.message || "Invalid OTP. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    // Handle new password submission
    const handlePasswordSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        if (newPasswordData.password !== newPasswordData.confirmPassword) {
            setError("Passwords do not match.");
            setLoading(false);
            return;
        }

        if (newPasswordData.password.length < 8) {
            setError("Password must be at least 8 characters long.");
            setLoading(false);
            return;
        }

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/reset/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: formData.username,
                    newPassword: newPasswordData.password
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to reset password');
            }

            // Redirect to login page or show success message
            router.push('/Login?message=Password reset successful');

        } catch (err) {
            setError(err.message || "Failed to reset password. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const maskEmail = (email) => {
        const [username, domain] = email.split("@");
        const visiblePart = username.slice(0, 4);
        const maskedPart = "*".repeat(Math.max(0, username.length - 4));
        return `${visiblePart}${maskedPart}@${domain}`;
    };

    // Reset to username step
    const handleBackToUsername = () => {
        setStep('username');
        setOtpSent(false);
        setUserEmail("");
        setError("");
    };

    return (
        <div className='min-h-screen flex items-center justify-center'>
            <div className='max-w-md w-full space-y-8 p-6'>
                <div className="text-center">
                    <h2 className="text-3xl font-bold text-gray-100 mb-2 pb-20">
                        Reset Password
                    </h2>
                </div>

                {/* Username Step */}
                {step === 'username' && (
                    <form className="mt-8 space-y-6 bg-white/10 backdrop-blur-3xl p-6 px-5 rounded-lg" onSubmit={handleUsernameSubmit}>
                        <div className="space-y-4">
                            <LabelInputContainer>
                                <Label htmlFor="username" className="block text-sm font-medium mb-1">
                                    Username
                                </Label>
                                <Input
                                    id="username"
                                    name="username"
                                    type="text"
                                    required
                                    placeholder="Enter your username"
                                    value={formData.username}
                                    onChange={handleChange}
                                />
                            </LabelInputContainer>
                        </div>

                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="group/btn relative block h-10 w-full rounded-md bg-gradient-to-br from-black to-neutral-600 font-medium text-white shadow-[0px_1px_0px_0px_#ffffff40_inset,0px_-1px_0px_0px_#ffffff40_inset] dark:bg-zinc-800 dark:from-zinc-900 dark:to-zinc-900 dark:shadow-[0px_1px_0px_0px_#27272a_inset,0px_-1px_0px_0px_#27272a_inset] disabled:cursor-not-allowed"
                        >
                            {loading ? "Looking up user..." : "Continue"}
                            <BottomGradient />
                        </button>
                    </form>
                )}

                {/* OTP Step */}
                {step === 'otp' && (
                    <div className="mt-8 space-y-6 bg-white/10 backdrop-blur-3xl p-6 px-5 rounded-lg">
                        {!otpSent ? (
                            <div>
                                <div className='flex justify-center items-center flex-col gap-3 mb-6'>
                                    <span className='block text-amber-50 text-center'>
                                        We found your account! Send OTP to {maskEmail(userEmail)}?
                                    </span>
                                    <div className="flex gap-3">
                                        <button
                                            className='p-2 bg-white/10 backdrop-blur-2xl rounded-lg text-white hover:bg-white/20 transition-colors'
                                            onClick={handleSendOTP}
                                            disabled={loading}
                                        >
                                            {loading ? "Sending..." : "Send OTP"}
                                        </button>
                                        <button
                                            className='p-2 bg-gray-600/50 backdrop-blur-2xl rounded-lg text-white hover:bg-gray-600/70 transition-colors'
                                            onClick={handleBackToUsername}
                                        >
                                            Back
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <form onSubmit={handleOTPSubmit}>
                                <div className="space-y-4">
                                    <LabelInputContainer>
                                        <Label htmlFor="otp" className="block text-sm font-medium mb-1">
                                            Enter OTP sent to {maskEmail(userEmail)}
                                        </Label>
                                        <Input
                                            id="otp"
                                            name="otp"
                                            type="text"
                                            required
                                            placeholder="Enter 6-digit OTP"
                                            value={otpData.otp}
                                            onChange={handleChange}
                                            maxLength={6}
                                        />
                                    </LabelInputContainer>
                                </div>

                                {error && (
                                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
                                        {error}
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="group/btn relative block h-10 w-full rounded-md bg-gradient-to-br from-black to-neutral-600 font-medium text-white shadow-[0px_1px_0px_0px_#ffffff40_inset,0px_-1px_0px_0px_#ffffff40_inset] dark:bg-zinc-800 dark:from-zinc-900 dark:to-zinc-900 dark:shadow-[0px_1px_0px_0px_#27272a_inset,0px_-1px_0px_0px_#27272a_inset] disabled:cursor-not-allowed"
                                >
                                    {loading ? "Verifying..." : "Verify OTP"}
                                    <BottomGradient />
                                </button>

                                <div className="flex justify-center mt-4">
                                    <button
                                        type="button"
                                        className='text-sm text-amber-50 hover:text-white underline'
                                        onClick={handleBackToUsername}
                                    >
                                        Change username
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                )}

                {/* New Password Step */}
                {step === 'newPassword' && (
                    <form className="mt-8 space-y-6 bg-white/10 backdrop-blur-3xl p-6 px-5 rounded-lg" onSubmit={handlePasswordSubmit}>
                        <div className="space-y-4">
                            <LabelInputContainer>
                                <Label htmlFor="password" className="block text-sm font-medium mb-1">
                                    New Password
                                </Label>
                                <Input
                                    id="password"
                                    name="password"
                                    type="password"
                                    required
                                    placeholder="Enter new password"
                                    value={newPasswordData.password}
                                    onChange={handleChange}
                                />
                            </LabelInputContainer>

                            <LabelInputContainer>
                                <Label htmlFor="confirmPassword" className="block text-sm font-medium mb-1">
                                    Confirm New Password
                                </Label>
                                <Input
                                    id="confirmPassword"
                                    name="confirmPassword"
                                    type="password"
                                    required
                                    placeholder="Confirm new password"
                                    value={newPasswordData.confirmPassword}
                                    onChange={handleChange}
                                />
                            </LabelInputContainer>
                        </div>

                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="group/btn relative block h-10 w-full rounded-md bg-gradient-to-br from-black to-neutral-600 font-medium text-white shadow-[0px_1px_0px_0px_#ffffff40_inset,0px_-1px_0px_0px_#ffffff40_inset] dark:bg-zinc-800 dark:from-zinc-900 dark:to-zinc-900 dark:shadow-[0px_1px_0px_0px_#27272a_inset,0px_-1px_0px_0px_#27272a_inset] disabled:cursor-not-allowed"
                        >
                            {loading ? "Resetting Password..." : "Reset Password"}
                            <BottomGradient />
                        </button>
                    </form>
                )}
            </div>
        </div>
    )
}

const BottomGradient = () => {
    return (
        <>
            <span className="absolute inset-x-0 -bottom-px block h-px w-full bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-0 transition duration-500 group-hover/btn:opacity-100" />
            <span className="absolute inset-x-10 -bottom-px mx-auto block h-px w-1/2 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-0 blur-sm transition duration-500 group-hover/btn:opacity-100" />
        </>
    );
};

const LabelInputContainer = ({ children, className }) => {
    return (
        <div className={cn("flex w-full flex-col space-y-2", className)}>
            {children}
        </div>
    );
};

export default ResetPassword