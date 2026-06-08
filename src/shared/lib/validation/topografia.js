import { z } from "zod";

export const coordenadaSchema = z.object({
  punto: z.string().min(1),
  norte: z.number(),
  este: z.number(),
  cota_z: z.number(),
  descripcion: z.string(),
});

export const coordenadasSchema = z.array(coordenadaSchema);
