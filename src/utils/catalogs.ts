// src/catalogs.ts
export const catalogs: Record<string, any[]> = {
    paises: [
        "Ecuador",
        "Colombia",
        "Perú",
        "Chile",
        "México",
        "Brasil",
        "Argentina"
    ],

    destinos: [
        "Guayaquil",
        "Quito",
        "Medellín",
        "Lima",
        "Santiago",
        "CDMX"
    ],

    semanas: Array.from({ length: 52 }, (_, i) => i + 1),
};
