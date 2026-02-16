import { Schema, model, Document, Types } from "mongoose";

/**
 * Un valor individual dentro de un catálogo
 * Ej: Ecuador, Laptop, Proveedor ABC
 */
export interface ICatalogValue {
    key: string;              // valor que se guarda (EC, laptop, prov-1)
    label: string;            // valor visible (Ecuador, Laptop)
    activo: boolean;          // soft delete
    metadata?: Record<string, any>; // datos extra opcionales
}

/**
 * Documento principal del catálogo
 * Un documento = un tipo de catálogo
 */
export interface ICatalog extends Document {
    tipo: string;             // paisesOrigen, proveedores, descripciones, etc.
    label: string;            // nombre legible
    valores: ICatalogValue[]; // opciones del select
    editable: boolean;        // si se puede modificar desde UI
    orden: number;            // orden visual
    tenantId?: Types.ObjectId; // multi-tenant (opcional)
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Schema de los valores del catálogo
 */
const CatalogValueSchema = new Schema<ICatalogValue>(
    {
        key: {
            type: String,
            required: true,
            trim: true
        },
        label: {
            type: String,
            required: true,
            trim: true
        },
        activo: {
            type: Boolean,
            default: true
        },
        metadata: {
            type: Schema.Types.Mixed,
            default: {}
        }
    },
    {
        _id: false // no necesitamos _id por cada opción
    }
);

/**
 * Schema principal del catálogo
 */
const CatalogSchema = new Schema<ICatalog>(
    {
        tipo: {
            type: String,
            required: true,
            trim: true,
            index: true
        },
        label: {
            type: String,
            required: true,
            trim: true
        },
        valores: {
            type: [CatalogValueSchema],
            default: []
        },
        editable: {
            type: Boolean,
            default: true
        },
        orden: {
            type: Number,
            default: 0
        },
        tenantId: {
            type: Schema.Types.ObjectId,
            ref: "Tenant",
            required: false,
            index: true
        }
    },
    {
        timestamps: true
    }
);

/**
 * Evita duplicar catálogos por tipo (y tenant si aplica)
 */
CatalogSchema.index(
    { tipo: 1, tenantId: 1 },
    { unique: true }
);

export const Catalog = model<ICatalog>("Catalog", CatalogSchema);
export default Catalog;
