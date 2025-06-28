// data/doctors.js

const doctors = [
    { name: "Dr. Mehta", specialty: "Dentist", busySlots: ["10:00", "14:00"] },
    { name: "Dr. Kapoor", specialty: "Pediatrician", busySlots: ["11:00", "15:30"] },
    { name: "Dr. Sharma", specialty: "Cardiologist", busySlots: ["09:00", "16:00"] },
    { name: "Dr. Reddy", specialty: "Orthopedic", busySlots: ["10:30", "12:00"] },
    { name: "Dr. Iyer", specialty: "ENT", busySlots: ["11:30", "13:30"] },
    { name: "Dr. Joshi", specialty: "Dermatologist", busySlots: ["10:00", "15:00"] },
    { name: "Dr. Singh", specialty: "General Physician", busySlots: ["09:30", "12:30"] },
    { name: "Dr. Khan", specialty: "Neurologist", busySlots: ["11:00", "14:30"] },
    { name: "Dr. Das", specialty: "Gastroenterologist", busySlots: ["12:00", "17:00"] },
    { name: "Dr. Roy", specialty: "Psychiatrist", busySlots: ["13:00", "16:30"] },
  ];
  
  const availableSlots = ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "13:00", "14:00", "15:00", "16:00"];
  
  module.exports = { doctors, availableSlots };