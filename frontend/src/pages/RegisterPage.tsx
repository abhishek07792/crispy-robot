import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { ShieldCheck, AlertTriangle } from 'lucide-react'
import { useState } from 'react'

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})
type FormData = z.infer<typeof schema>

export default function RegisterPage() {
  const { register: registerUser } = useAuth()
  const { addToast } = useToast()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    try {
      await registerUser(data.email, data.password)
      navigate('/dashboard')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Registration failed. Try again.'
      addToast('error', 'Registration Failed', msg)
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-navy-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <ShieldCheck className="w-8 h-8 text-accent-400" />
          <span className="font-bold text-xl">VAPT Framework</span>
        </div>

        <div className="glass-card p-8">
          <h1 className="text-2xl font-bold text-white mb-1">Create account</h1>
          <p className="text-sm text-navy-400 mb-7">Join the analysis platform</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-navy-200 mb-1.5">Email address</label>
              <input {...register('email')} type="email" placeholder="analyst@example.com"
                className={`input-field ${errors.email ? 'border-critical/60' : ''}`} />
              {errors.email && <p className="mt-1 text-xs text-critical">{errors.email.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-navy-200 mb-1.5">Password</label>
              <input {...register('password')} type="password" placeholder="Minimum 8 characters"
                className={`input-field ${errors.password ? 'border-critical/60' : ''}`} />
              {errors.password && <p className="mt-1 text-xs text-critical">{errors.password.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-navy-200 mb-1.5">Confirm password</label>
              <input {...register('confirmPassword')} type="password" placeholder="Repeat password"
                className={`input-field ${errors.confirmPassword ? 'border-critical/60' : ''}`} />
              {errors.confirmPassword && <p className="mt-1 text-xs text-critical">{errors.confirmPassword.message}</p>}
            </div>

            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-medium/5 border border-medium/20">
              <AlertTriangle className="w-4 h-4 text-medium flex-shrink-0 mt-0.5" />
              <p className="text-xs text-navy-300">
                By registering you confirm you will only assess infrastructure you own or are explicitly authorized to test.
              </p>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading && <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />}
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-sm text-navy-400 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-accent-400 hover:text-accent-300 font-medium transition-colors">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
