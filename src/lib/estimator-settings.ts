import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  DEFAULT_CHANNELS,
  DEFAULT_FAILURE_BUFFER_PERCENT,
  DEFAULT_TARGET_PROFIT_PERCENT,
  type ChannelFeeProfile,
} from "@/lib/estimator-constants";
import { assertWritable } from "@/lib/read-only";

const configError = new Error(
  "Firebase isn't configured yet. Add your project's keys to .env.local and restart the dev server.",
);

export type EstimatorSettings = {
  machineRatePerHour: number;
  electricityRatePerHour: number;
  laborRatePerHour: number;
  failureBufferPercent: number;
  targetProfitPercent: number;
  packagingCost: number;
  shippingCost: number;
  channels: ChannelFeeProfile[];
};

export const DEFAULT_ESTIMATOR_SETTINGS: EstimatorSettings = {
  machineRatePerHour: 0.75,
  electricityRatePerHour: 0.25,
  laborRatePerHour: 0,
  failureBufferPercent: DEFAULT_FAILURE_BUFFER_PERCENT,
  targetProfitPercent: DEFAULT_TARGET_PROFIT_PERCENT,
  packagingCost: 0.5,
  shippingCost: 0,
  channels: DEFAULT_CHANNELS,
};

function settingsDoc(ownerId: string) {
  if (!db) throw configError;
  return doc(db, "settings", ownerId);
}

export async function getEstimatorSettings(ownerId: string): Promise<EstimatorSettings> {
  if (!db) throw configError;
  const snap = await getDoc(settingsDoc(ownerId));
  if (!snap.exists()) return DEFAULT_ESTIMATOR_SETTINGS;
  const data = snap.data();
  const savedChannels = (data.channels as ChannelFeeProfile[] | undefined)?.filter((channel) => channel.id !== "custom");
  return {
    machineRatePerHour: data.machineRatePerHour ?? DEFAULT_ESTIMATOR_SETTINGS.machineRatePerHour,
    electricityRatePerHour: data.electricityRatePerHour ?? DEFAULT_ESTIMATOR_SETTINGS.electricityRatePerHour,
    laborRatePerHour: data.laborRatePerHour ?? DEFAULT_ESTIMATOR_SETTINGS.laborRatePerHour,
    failureBufferPercent: data.failureBufferPercent ?? DEFAULT_ESTIMATOR_SETTINGS.failureBufferPercent,
    targetProfitPercent: data.targetProfitPercent ?? DEFAULT_ESTIMATOR_SETTINGS.targetProfitPercent,
    packagingCost: data.packagingCost ?? DEFAULT_ESTIMATOR_SETTINGS.packagingCost,
    shippingCost: data.shippingCost ?? DEFAULT_ESTIMATOR_SETTINGS.shippingCost,
    channels: savedChannels && savedChannels.length > 0 ? savedChannels : DEFAULT_ESTIMATOR_SETTINGS.channels,
  };
}

export async function saveEstimatorSettings(ownerId: string, settings: EstimatorSettings) {
  assertWritable();
  if (!db) throw configError;
  await setDoc(settingsDoc(ownerId), settings, { merge: true });
}
