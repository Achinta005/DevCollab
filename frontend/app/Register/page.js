import React from 'react'
import { SignupFormDemo } from './SignupFormDemo'

const page = () => {
  return (
    <div className=" bg-cover bg-center"
      style={{
        backgroundImage:
          "url('https://res.cloudinary.com/dc1fkirb4/image/upload/v1756099416/abstract-square-interface-modern-background-concept-fingerprint-digital-scanning-visual-security-system-authentication-login-vector_adnpaf.jpg')"
      }}>
        <SignupFormDemo />
    </div>
  )
}

export default page