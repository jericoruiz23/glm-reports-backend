import { Schema, model, Document, Types } from "mongoose";

export interface ICatalogValue {
    key: string;
    label: string;
    activo: boolean;
    metadata?: Record<string, any>;
}

export interface ICatalog extends Document {
    tipo: string;
    label: string;
    valores: ICatalogValue[];
    editable: boolean;
    orden: number;
    tenantId?: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

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
        _id: false
    }
);

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

CatalogSchema.index(
    { tipo: 1, tenantId: 1 },
    { unique: true }
);

export const Catalog = model<ICatalog>("Catalog", CatalogSchema);
export default Catalog;
