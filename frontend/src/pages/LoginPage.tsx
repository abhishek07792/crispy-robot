import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { ShieldCheck } from 'lucide-react'
import { useState } from 'react'

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})
type FormData = z.infer<typeof schema>

export default function LoginPage() {
  const { login } = useAuth()
  const { addToast } = useToast()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    try {
      await login(data.email, data.password)
      navigate('/dashboard')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Login failed. Check your credentials.'
      addToast('error', 'Login Failed', msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-navy-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <ShieldCheck className="w-8 h-8 text-accent-400" />
          <span className="font-bold text-xl">VAPT Framework</span>
        </div>

        <div className="glass-card p-8">
          <h1 className="text-2xl font-bold text-white mb-1">Welcome back</h1>
          <p className="text-sm text-navy-400 mb-7">Sign in to your analysis workspace</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-navy-200 mb-1.5">Email address</label>
              <input {...register('email')} type="email" placeholder="analyst@example.com"
                className={`input-field ${errors.email ? 'border-critical/60' : ''}`} />
              {errors.email && <p className="mt-1 text-xs text-critical">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-navy-200 mb-1.5">Password</label>
              <input {...register('password')} type="password" placeholder="••••••••"
                className={`input-field ${errors.password ? 'border-critical/60' : ''}`} />
              {errors.password && <p className="mt-1 text-xs text-critical">{errors.password.message}</p>}
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : null}
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-sm text-navy-400 mt-6">
            No account?{' '}
            <Link to="/register" className="text-accent-400 hover:text-accent-300 font-medium transition-colors">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
