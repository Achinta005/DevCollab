"use client"
import { Plus } from 'lucide-react'
import React from 'react'
import { useRouter } from 'next/navigation'

const Project = () => {
  const router = useRouter();
  return (
    <div className='flex justify-center py-15'>

      <div>
        <button className='w-35 h-40 bg-white/10 backdrop-blur-2xl cursor-pointer flex items-center  justify-center rounded-lg active:scale-90 transition-transform duration-200 ease-in-out text-green-600' onClick={() => router.push('/Editor')}>
          <Plus size={48} />
        </button>
        <h1>Create a New Project</h1>
      </div>

      {/* This part is for mapping existing projects */}
      <div>

      </div>
    </div>
  )
}

export default Project