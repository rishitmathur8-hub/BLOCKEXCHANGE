import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Section, OverlapCheckResult } from '@/types';
import { api } from '@/api/client';
import { parseTimeToMinutes, minutesToTimeString, fmtMinutes, formatDuration } from '@/utils/time';
import {
  Send,
  AlertTriangle,
  GitMerge,
  Sparkles,
  CheckCircle2,
  Calendar,
  Clock,
  MapPin,
  Wrench,
  Zap,
} from 'lucide-react';
import { useRole } from '@/context/RoleContext';

const requestSchema = z
  .object({
    dept: z.string().min(1, 'Department is required'),
    section_id: z.number({ invalid_type_error: 'Please select a valid section' }).min(1),
    date: z.string().min(1, 'Date is required'),
    startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:mm)'),
    endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:mm)'),
    duration_min: z.number().min(15, 'Minimum duration is 15 minutes').max(720, 'Maximum duration is 12 hours'),
    km_from: z.number().min(0, 'KM must be non-negative'),
    km_to: z.number().min(0, 'KM must be non-negative'),
    work_type: z.string().min(1, 'Work type is required'),
    priority: z.enum(['HIGH', 'MEDIUM', 'ROUTINE']),
    needs_power_block: z.boolean().default(false),
    resources: z.string().optional(),
  })
  .refine((data) => data.km_from <= data.km_to, {
    message: 'KM From must be less than or equal to KM To',
    path: ['km_to'],
  })
  .refine(
    (data) => {
      const startMin = parseTimeToMinutes(data.startTime);
      const endMin = parseTimeToMinutes(data.endTime);
      return endMin - startMin >= data.duration_min;
    },
    {
      message: 'Permissible window must be at least as long as required duration',
      path: ['endTime'],
    }
  );

type RequestFormData = z.infer<typeof requestSchema>;

interface NewRequestFormProps {
  onSuccess: () => void;
}

export const NewRequestForm: React.FC<NewRequestFormProps> = ({ onSuccess }) => {
  const { role, userName } = useRole();
  const [sections, setSections] = useState<Section[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [overlapResult, setOverlapResult] = useState<OverlapCheckResult | null>(null);
  const [isCheckingOverlap, setIsCheckingOverlap] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const todayStr = new Date().toISOString().split('T')[0];

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<RequestFormData>({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      dept: role.includes('S&T') ? 'S&T' : role.includes('OHE') ? 'OHE' : 'Engineering',
      section_id: 1,
      date: todayStr,
      startTime: '10:00',
      endTime: '14:00',
      duration_min: 90,
      km_from: 24.0,
      km_to: 28.5,
      work_type: 'track_repair',
      priority: 'MEDIUM',
      needs_power_block: false,
      resources: '1x Tie Tamper Machine, 12 Trackmen crew',
    },
  });

  const watchedValues = watch();

  useEffect(() => {
    api
      .getSections()
      .then((data) => setSections(data))
      .catch((err) => console.error('Failed to load sections', err));
  }, []);

  // Real-time check overlap when location/time parameters change
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (
        watchedValues.section_id &&
        watchedValues.km_from !== undefined &&
        watchedValues.km_to !== undefined &&
        watchedValues.km_from <= watchedValues.km_to &&
        watchedValues.startTime &&
        watchedValues.endTime &&
        watchedValues.duration_min
      ) {
        const startMin = parseTimeToMinutes(watchedValues.startTime);
        const endMin = parseTimeToMinutes(watchedValues.endTime);
        if (endMin - startMin >= watchedValues.duration_min) {
          setIsCheckingOverlap(true);
          try {
            const res = await api.checkOverlap({
              section_id: Number(watchedValues.section_id),
              km_from: Number(watchedValues.km_from),
              km_to: Number(watchedValues.km_to),
              window_start: startMin,
              window_end: endMin,
              duration_min: Number(watchedValues.duration_min),
            });
            setOverlapResult(res);
          } catch (err) {
            // non-fatal preview check
          } finally {
            setIsCheckingOverlap(false);
          }
        }
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [
    watchedValues.section_id,
    watchedValues.km_from,
    watchedValues.km_to,
    watchedValues.startTime,
    watchedValues.endTime,
    watchedValues.duration_min,
  ]);

  const onSubmit = async (data: RequestFormData) => {
    setIsSubmitting(true);
    setServerError(null);
    try {
      const window_start = parseTimeToMinutes(data.startTime);
      const window_end = parseTimeToMinutes(data.endTime);

      const created = await api.createRequest({
        dept: data.dept,
        section_id: Number(data.section_id),
        km_from: Number(data.km_from),
        km_to: Number(data.km_to),
        duration_min: Number(data.duration_min),
        window_start,
        window_end,
        work_type: data.work_type,
        needs_power_block: data.needs_power_block,
      });

      // Audit log creation
      await api.createAuditLog({
        user_role: role,
        user_name: userName,
        action: 'CREATE_REQUEST',
        entity_type: 'request',
        entity_id: String(created.id),
        reason: `New maintenance closure request filed for ${data.dept} on km ${data.km_from}–${data.km_to}.`,
        details: `Duration: ${data.duration_min}m. Window: ${data.startTime}–${data.endTime}. Power block: ${data.needs_power_block}.`,
      });

      setSubmitSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err: any) {
      setServerError(err.message || 'Failed to submit request to backend.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedSection = sections.find((s) => s.id === Number(watchedValues.section_id));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400">
            Unified Single Window
          </span>
          <h2 className="text-2xl font-condensed font-bold text-white tracking-wide">
            Request Track Maintenance Closure (Block)
          </h2>
          <p className="text-xs text-slate-400">
            Submit your departmental requisition. The system automatically inspects for overlaps and proposes joint execution.
          </p>
        </div>
      </div>

      {serverError && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{serverError}</span>
        </div>
      )}

      {submitSuccess && (
        <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <div>
            <p className="font-bold">Request Successfully Recorded in Backend!</p>
            <p className="text-[11px] text-emerald-300/80">
              Assigned to unassigned pool. Redirecting to timeline...
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="p-6 rounded-2xl bg-railway-900 border border-railway-750 shadow-xl space-y-5">
          {/* Section & Department */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Department
              </label>
              <select
                {...register('dept')}
                className="w-full px-3 py-2 rounded-xl bg-railway-950 border border-railway-750 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Engineering">Engineering (Civil / Track)</option>
                <option value="S&T">S&T (Signals & Telecommunications)</option>
                <option value="OHE">Electrical (OHE / Traction)</option>
                <option value="Mechanical">Mechanical / C&W</option>
              </select>
              {errors.dept && <p className="text-[11px] text-rose-400 mt-1">{errors.dept.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Track Section
              </label>
              <select
                {...register('section_id', { valueAsNumber: true })}
                className="w-full px-3 py-2 rounded-xl bg-railway-950 border border-railway-750 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.length_km} km)
                  </option>
                ))}
              </select>
              {errors.section_id && (
                <p className="text-[11px] text-rose-400 mt-1">{errors.section_id.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-400" />
                <span>Proposed Date</span>
              </label>
              <input
                type="date"
                {...register('date')}
                className="w-full px-3 py-2 rounded-xl bg-railway-950 border border-railway-750 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.date && <p className="text-[11px] text-rose-400 mt-1">{errors.date.message}</p>}
            </div>
          </div>

          {/* Location KM range */}
          <div className="p-4 rounded-xl bg-railway-850/60 border border-railway-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-amber-400" />
                Track Kilometer Boundary
              </span>
              {selectedSection && (
                <span className="text-[11px] text-slate-400 font-mono">
                  Section limits: 0.0 km to {selectedSection.length_km} km
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">From Kilometer</label>
                <input
                  type="number"
                  step="0.1"
                  {...register('km_from', { valueAsNumber: true })}
                  placeholder="e.g. 22.0"
                  className="w-full px-3 py-2 rounded-xl bg-railway-950 border border-railway-750 text-xs text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errors.km_from && (
                  <p className="text-[11px] text-rose-400 mt-1">{errors.km_from.message}</p>
                )}
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">To Kilometer</label>
                <input
                  type="number"
                  step="0.1"
                  {...register('km_to', { valueAsNumber: true })}
                  placeholder="e.g. 28.5"
                  className="w-full px-3 py-2 rounded-xl bg-railway-950 border border-railway-750 text-xs text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errors.km_to && (
                  <p className="text-[11px] text-rose-400 mt-1">{errors.km_to.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Timing Window & Duration */}
          <div className="p-4 rounded-xl bg-railway-850/60 border border-railway-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-400" />
                Permissible Maintenance Window (IST, 24-Hour)
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                Duration required: {formatDuration(watchedValues.duration_min || 0)}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Earliest Start (HH:mm)
                </label>
                <input
                  type="time"
                  {...register('startTime')}
                  className="w-full px-3 py-2 rounded-xl bg-railway-950 border border-railway-750 text-xs text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errors.startTime && (
                  <p className="text-[11px] text-rose-400 mt-1">{errors.startTime.message}</p>
                )}
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Latest Finish (HH:mm)
                </label>
                <input
                  type="time"
                  {...register('endTime')}
                  className="w-full px-3 py-2 rounded-xl bg-railway-950 border border-railway-750 text-xs text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errors.endTime && (
                  <p className="text-[11px] text-rose-400 mt-1">{errors.endTime.message}</p>
                )}
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Required Work Duration (Minutes)
                </label>
                <input
                  type="number"
                  step="15"
                  {...register('duration_min', { valueAsNumber: true })}
                  placeholder="e.g. 90"
                  className="w-full px-3 py-2 rounded-xl bg-railway-950 border border-railway-750 text-xs text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errors.duration_min && (
                  <p className="text-[11px] text-rose-400 mt-1">{errors.duration_min.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Work Details & Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5 text-blue-400" />
                Nature of Maintenance Work
              </label>
              <select
                {...register('work_type')}
                className="w-full px-3 py-2 rounded-xl bg-railway-950 border border-railway-750 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="track_repair">Track Repair / Sleeper Renewal</option>
                <option value="rail_welding">Rail Welding / De-stressing</option>
                <option value="ballast_work">Ballast Cleaning / Tamping</option>
                <option value="signal_work">Signal Inspection & Cable Works</option>
                <option value="point_maintenance">Point & Crossing Overhaul</option>
                <option value="ohe_work">OHE Bracket / Contact Wire Maint.</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Operational Priority
              </label>
              <select
                {...register('priority')}
                className="w-full px-3 py-2 rounded-xl bg-railway-950 border border-railway-750 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="HIGH">High (Safety critical / Speed restriction removal)</option>
                <option value="MEDIUM">Medium (Scheduled asset maintenance)</option>
                <option value="ROUTINE">Routine (Preventative inspection)</option>
              </select>
            </div>
          </div>

          {/* Power Block & Resources */}
          <div className="space-y-3 pt-2 border-t border-railway-800">
            <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl bg-railway-850/40 border border-railway-800 hover:border-purple-500/40 transition">
              <input
                type="checkbox"
                {...register('needs_power_block')}
                className="w-4 h-4 rounded text-purple-600 bg-railway-950 border-railway-700 focus:ring-purple-500"
              />
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-purple-400" />
                <div>
                  <span className="text-xs font-semibold text-slate-200 block">
                    Requires OHE Power Isolation (Traction Shut Down)
                  </span>
                  <span className="text-[11px] text-slate-400 block">
                    Electrical department permit-to-work and earthing required before possession
                  </span>
                </div>
              </div>
            </label>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Assigned Machinery & Crew Resources (Optional)
              </label>
              <input
                type="text"
                {...register('resources')}
                placeholder="e.g. 1x BCM machine, 20 gangmen, 1 Tower Wagon"
                className="w-full px-3 py-2 rounded-xl bg-railway-950 border border-railway-750 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Real-Time Backend Overlap Analysis Callout */}
        {overlapResult && overlapResult.has_overlaps && (
          <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-amber-200 shadow-xl space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                <h4 className="text-sm font-bold text-white">
                  Overlapping Corridor Requisitions Detected
                </h4>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30">
                Joint Merge Candidate
              </span>
            </div>

            <p className="text-xs text-amber-200/90 leading-relaxed">
              {overlapResult.reason} Merging these overlapping jobs into a single combined closure will avoid multiple line blockages and minimize passenger train disruption.
            </p>

            {/* Overlapping items detail list */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
              {overlapResult.overlapping_requests.map((req) => (
                <div
                  key={req.id}
                  className="p-2.5 rounded-lg bg-railway-900/90 border border-amber-500/20 text-xs text-slate-300 flex items-center justify-between"
                >
                  <div>
                    <span className="font-semibold text-amber-300">
                      Req #{req.id} ({req.dept})
                    </span>
                    <p className="text-[11px] text-slate-400">
                      {req.work_type} • km {req.km_from}–{req.km_to}
                    </p>
                  </div>
                  <span className="font-mono text-[11px] text-slate-300">
                    {fmtMinutes(req.window_start)}–{fmtMinutes(req.window_end)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-railway-700 hover:from-blue-500 hover:to-railway-650 text-white font-bold text-xs tracking-wide shadow-lg shadow-blue-500/20 transition active:scale-95 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            <span>{isSubmitting ? 'Registering Request...' : 'Submit Block Requisition'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
