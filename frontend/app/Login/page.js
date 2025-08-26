import React from 'react'
import LoginPage from './LoginPage'

const page = () => {
  return (
    <div className=" bg-cover bg-center"
      style={{
        backgroundImage:
          "url('https://res.cloudinary.com/dc1fkirb4/image/upload/v1756099416/abstract-square-interface-modern-background-concept-fingerprint-digital-scanning-visual-security-system-authentication-login-vector_adnpaf.jpg')"
      }}>
      <LoginPage />
    </div>
  )
}

export default page