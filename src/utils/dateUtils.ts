export const calcularDiasLaborables = (fechaInicio: Date, fechaFin: Date): number => {
    const start = new Date(fechaInicio);
    const end = new Date(fechaFin);

    start.setUTCHours(12, 0, 0, 0);
    end.setUTCHours(12, 0, 0, 0);

    if (end < start) return 0;

    let dias = 0;
    const current = new Date(start);

    while (current < end) {
        const day = current.getDay(); // 0=domingo, 6=sábado
        if (day !== 0 && day !== 6) {
            dias++;
        }
        current.setDate(current.getDate() + 1);
    }

    return dias;
};
