const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const authenticate = require('../middleware/auth');

router.use(authenticate);

// GET /appointments?date=2024-01-15 — list appointments (filter by date)
router.get('/', async (req, res) => {
  const { date, status, patient_id } = req.query;

  let query = supabase
    .from('appointments')
    .select(`
      *,
      patients ( id, name, phone, age, blood_group )
    `)
    .eq('doctor_id', req.doctorId)
    .order('appointment_time', { ascending: true });

  if (date) query = query.eq('appointment_date', date);
  if (status) query = query.eq('status', status);
  if (patient_id) query = query.eq('patient_id', patient_id);

  const { data, error } = await query;
  if (error) return res.status(400).json({ error: error.message });

  res.json({ appointments: data });
});

// GET /appointments/slots?date=2024-01-15 — get available slots for a date
router.get('/slots', async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'date is required' });

  // Get doctor working hours and slot duration
  const { data: doctor } = await supabase
    .from('doctors')
    .select('working_hours, slot_duration_minutes')
    .eq('id', req.doctorId)
    .single();

  // Get booked appointments for that date
  const { data: booked } = await supabase
    .from('appointments')
    .select('appointment_time')
    .eq('doctor_id', req.doctorId)
    .eq('appointment_date', date)
    .neq('status', 'cancelled');

  const bookedTimes = booked.map(a => a.appointment_time);
  const dayName = new Date(date).toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase();
  const hours = doctor.working_hours[dayName];

  if (!hours || hours === 'closed') {
    return res.json({ slots: [], message: 'Clinic closed on this day' });
  }

  // Generate slots
  const [start, end] = hours.split('-');
  const slots = [];
  let current = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);
  const duration = doctor.slot_duration_minutes || 15;

  while (current + duration <= endMinutes) {
    const timeStr = minutesToTime(current);
    slots.push({
      time: timeStr,
      available: !bookedTimes.includes(timeStr + ':00')
    });
    current += duration;
  }

  res.json({ slots, slot_duration: duration });
});

// GET /appointments/:id
router.get('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('appointments')
    .select(`*, patients (*)`)
    .eq('id', req.params.id)
    .eq('doctor_id', req.doctorId)
    .single();

  if (error) return res.status(404).json({ error: 'Appointment not found' });
  res.json({ appointment: data });
});

// POST /appointments — book appointment
router.post('/', async (req, res) => {
  const { patient_id, appointment_date, appointment_time, problem, notes, follow_up_date } = req.body;

  if (!patient_id || !appointment_date || !appointment_time) {
    return res.status(400).json({ error: 'patient_id, appointment_date and appointment_time are required' });
  }

  // Check slot not already taken
  const { data: existing } = await supabase
    .from('appointments')
    .select('id')
    .eq('doctor_id', req.doctorId)
    .eq('appointment_date', appointment_date)
    .eq('appointment_time', appointment_time)
    .neq('status', 'cancelled');

  if (existing && existing.length > 0) {
    return res.status(409).json({ error: 'This slot is already booked' });
  }

  const { data, error } = await supabase
    .from('appointments')
    .insert({
      doctor_id: req.doctorId,
      patient_id, appointment_date, appointment_time,
      problem, notes, follow_up_date
    })
    .select(`*, patients (id, name, phone)`)
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json({ appointment: data });
});

// PUT /appointments/:id — update (status change, reschedule)
router.put('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('appointments')
    .update(req.body)
    .eq('id', req.params.id)
    .eq('doctor_id', req.doctorId)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json({ appointment: data });
});

// DELETE /appointments/:id — cancel
router.delete('/:id', async (req, res) => {
  const { error } = await supabase
    .from('appointments')
    .update({ status: 'cancelled' })
    .eq('id', req.params.id)
    .eq('doctor_id', req.doctorId);

  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: 'Appointment cancelled' });
});

// Helpers
function timeToMinutes(time) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}
function minutesToTime(minutes) {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

module.exports = router;
