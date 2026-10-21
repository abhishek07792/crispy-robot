import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import { assessmentsApi } from '../api/endpoints'
import { useToast } from '../context/ToastContext'
import { Shield, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react'

const schema = z.object({
  target: z.string().min(1, 'Target is required')
    .regex(/^(([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}|(\d{1,3}\.){3}\d{1,3})$/, 'Enter a valid domain or IP address'),
  authorized: z.literal(true, { errorMap: () => ({ message: 'You must confirm authorization' }) }),
  protocols: z.array(z.string()).min(1, 'Select at least one protocol'),
  notes: z.string().optional(),
})
type FormData = z.infer<typeof schema>

const PROTOCOLS = [
  { id: 'ftp',     label: 'FTP',     desc: 'Anonymous login, version CVEs — Fully implemented' },
  { id: 'redis',   label: 'Redis',   desc: 'Auth indicators, exposure context — Fully implemented' },
  { id: 'mongodb', label: 'MongoDB', desc: 'Auth indicators, exposure context — Architecture ready' },
  { id: 'smb',     label: 'SMB',     desc: 'Authentication indicators — Planned' },
  { id: 'smtp',    label: 'SMTP',    desc: 'Version CVEs — Planned' },
]

export default function NewAssessmentPage() {
  const { addToast } = useToast()
  const navigate = useNavigate()
  const [progress, setProgress] = useState<string | null>(null)

  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { protocols: ['ftp', 'redis'] },
  })

  const onSubmit = async (data: FormData) => {
    try {
      setProgress('Creating assessment record…')
      const res = await assessmentsApi.create({
        target: data.target,
        authorized: data.authorized,
        protocols: data.protocols,
        notes: data.notes,
      })
      setProgress('Assessment started — redirecting…')
      addToast('success', 'Assessment Started', `Analyzing ${data.target}`)
      navigate(`/assessments/${res.data.assessment.id}`)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to start assessment'
      addToast('error', 'Assessment Failed', msg)
      setProgress(null)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">New Assessment</h1>
        <p className="text-sm text-navy-400 mt-0.5">Passive exposure analysis using Shodan intelligence + NVD CVE correlation</p>
      </div>

      {/* Warning */}
      <div className="flex items-start gap-3 p-4 rounded-lg bg-medium/5 border border-medium/20">
        <AlertTriangle className="w-5 h-5 text-medium flex-shrink-0 mt-0.5" />
        <div className="text-sm text-navy-300 space-y-1">
          <p className="font-semibold text-medium">Authorization Required</p>
          <p>Only assess systems you own or have explicit written authorization to test. Entering a target does not grant any permission.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="glass-card p-6 space-y-6">
        {/* Target */}
        <div>
          <label className="block text-sm font-medium text-navy-200 mb-1.5">Target Domain or IP Address</label>
          <input {...register('target')} placeholder="example.com  or  192.168.1.1"
            className={`input-field font-mono ${errors.target ? 'border-critical/60' : ''}`} />
          {errors.target && <p className="mt-1 text-xs text-critical">{errors.target.message}</p>}
          <p className="mt-1.5 text-xs text-navy-400">Enter an authorized company domain or IP address you are permitted to assess.</p>
        </div>

        {/* Protocol selection */}
        <div>
          <label className="block text-sm font-medium text-navy-200 mb-2">Protocols to Analyze</label>
          <Controller name="protocols" control={control} render={({ field }) => (
            <div className="space-y-2">
              {PROTOCOLS.map(p => {
                const selected = field.value.includes(p.id)
                return (
                  <label key={p.id} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    selected ? 'bg-accent-500/10 border-accent-500/30' : 'bg-navy-800/40 border-navy-600/40 hover:border-navy-500/60'
                  }`}>
                    <input type="checkbox" checked={selected}
                      onChange={e => field.onChange(e.target.checked ? [...field.value, p.id] : field.value.filter((v: string) => v !== p.id))}
                      className="mt-0.5 accent-accent-500" />
                    <div>
                      <p className="font-medium text-sm text-white">{p.label}</p>
                      <p className="text-xs text-navy-400">{p.desc}</p>
                    </div>
                  </label>
                )
              })}
            </div>
          )} />
          {errors.protocols && <p className="mt-1 text-xs text-critical">{errors.protocols.message}</p>}
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-navy-200 mb-1.5">Notes (optional)</label>
          <textarea {...register('notes')} rows={2} placeholder="Assessment context, scope restrictions, etc."
            className="input-field resize-none" />
        </div>

        {/* Authorization checkbox */}
        <div>
          <label className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-all ${
            errors.authorized ? 'border-critical/40 bg-critical/5' : 'border-navy-600/40 bg-navy-800/40 hover:border-accent-500/30'
          }`}>
            <input type="checkbox" {...register('authorized')} className="mt-0.5 accent-accent-500" />
            <div className="text-sm">
              <p className="font-semibold text-white mb-0.5">I confirm I am authorized to assess this target</p>
              <p className="text-navy-400 text-xs">I own or have explicit written permission to perform security analysis on the target infrastructure. I understand this platform performs passive correlation only, not active exploitation.</p>
            </div>
          </label>
          {errors.authorized && <p className="mt-1 text-xs text-critical">{errors.authorized.message}</p>}
        </div>

        {/* Submit */}
        <div className="flex items-center gap-4">
          <button type="submit" disabled={isSubmitting} className="btn-primary">
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
            {isSubmitting ? 'Starting…' : 'Start Assessment'}
          </button>
          {progress && (
            <div className="flex items-center gap-2 text-sm text-accent-400">
              <CheckCircle className="w-4 h-4" /> {progress}
            </div>
          )}
        </div>
      </form>
    </div>
  )
}
