import React from 'react'
import { LogIn } from 'lucide-react'
import Link from 'next/link'

const Navbar = () => {
  return (
    <div>
      <div className='flex justify-end gap-6'>
        <Link href={"/Register"} className='flex gap-3 bg-white/40 p-2 mt-3 rounded-lg cursor-pointer active:scale-95 transition-transform ease-in-out'>Sign Up
          <img src="/signup.png" alt="sign_up" width={20} height={20} /></Link>
        <Link href={"/Login"} className='flex gap-3 bg-white/40 p-2 mt-3 mr-3 rounded-lg cursor-pointer active:scale-95 transition-transform ease-in-out'>Sign In<LogIn /></Link>
      </div>
    </div>
  )
}

export default Navbar