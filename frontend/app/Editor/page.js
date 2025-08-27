"use client"; // <-- important for client-side hooks like useSearchParams

import React, { Suspense } from "react";
import UserProfile from "./userinfo";

const Page = () => {
  return (
    <Suspense fallback={<div className="text-amber-50 p-5">Loading editor...</div>}>
      <UserProfile />
    </Suspense>
  );
};

export default Page;
