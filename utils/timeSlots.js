function getDoctorAvailableSlots(doctors, availableSlots) {
    return doctors.map((doctor) => {
      const busySet = new Set(doctor.busySlots);
      const freeSlots = availableSlots.filter((slot) => !busySet.has(slot));
      return {
        ...doctor,
        availableSlots: freeSlots,
      };
    });
  }
  
  function findDoctorAvailability(doctors, specialty, requestedTime) {
    const lowerSpecialty = specialty.toLowerCase();
    const matches = doctors.filter((d) => d.specialty.toLowerCase() === lowerSpecialty);
  
    if (matches.length === 0) {
      return { error: "Sorry, we have no doctor for that specialty." };
    }
  
    const doctor = matches[0]; // Use first matching doctor
    const isAvailable = !doctor.busySlots.includes(requestedTime);
  
    if (isAvailable) {
      return { doctor: doctor.name, time: requestedTime, available: true };
    }
  
    // Suggest next available time
    const slot = doctor.availableSlots.find((s) => s > requestedTime);
    return {
      doctor: doctor.name,
      time: slot || null,
      available: false,
    };
  }
  
  module.exports = { getDoctorAvailableSlots, findDoctorAvailability };