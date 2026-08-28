"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { createDriverProfile, updateDriverProfile } from "@/actions/drivers";
import FileUploadButton from "@/components/ui/FileUploadButton";
import { JAMAICA_PARISHES } from "@/lib/constants";

export type DriverProfileInitial = {
  displayName: string;
  bio: string | null;
  facePhotoUrl: string;
  parish: string;
  city: string | null;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: number | null;
  vehicleColor: string;
  vehiclePlate: string;
  vehiclePhotoUrl: string;
  perKmRateCents: number;
  minFareCents: number;
};

// Driver profile + vehicle form (driverProfileSchema fields, face and vehicle
// photo uploads included). mode "create" registers via createDriverProfile —
// which also flips a customer's role to driver — while "edit" saves in place.
export default function DriverProfileForm({
  mode,
  initial,
  onCreated,
}: {
  mode: "create" | "edit";
  initial?: DriverProfileInitial;
  onCreated?: () => void;
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initial?.displayName ?? "");
  const [bio, setBio] = useState(initial?.bio ?? "");
  const [facePhotoUrl, setFacePhotoUrl] = useState(initial?.facePhotoUrl ?? "");
  const [parish, setParish] = useState(initial?.parish ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [vehicleMake, setVehicleMake] = useState(initial?.vehicleMake ?? "");
  const [vehicleModel, setVehicleModel] = useState(initial?.vehicleModel ?? "");
  const [vehicleYear, setVehicleYear] = useState(
    initial?.vehicleYear ? String(initial.vehicleYear) : ""
  );
  const [vehicleColor, setVehicleColor] = useState(initial?.vehicleColor ?? "");
  const [vehiclePlate, setVehiclePlate] = useState(initial?.vehiclePlate ?? "");
  const [vehiclePhotoUrl, setVehiclePhotoUrl] = useState(
    initial?.vehiclePhotoUrl ?? ""
  );
  const [perKm, setPerKm] = useState(
    initial ? (initial.perKmRateCents / 100).toFixed(2) : "0"
  );
  const [minFare, setMinFare] = useState(
    initial ? (initial.minFareCents / 100).toFixed(2) : "0"
  );
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!facePhotoUrl) {
      toast.error("Upload a clear photo of your face — riders must see who is driving.");
      return;
    }
    if (!vehiclePhotoUrl) {
      toast.error("Upload a photo of your vehicle.");
      return;
    }
    if (!parish) {
      toast.error("Pick your home parish.");
      return;
    }
    const input = {
      displayName,
      bio,
      facePhotoUrl,
      parish,
      city,
      vehicleMake,
      vehicleModel,
      vehicleYear,
      vehicleColor,
      vehiclePlate,
      vehiclePhotoUrl,
      perKmRateCents: Math.round(Number(perKm || 0) * 100),
      minFareCents: Math.round(Number(minFare || 0) * 100),
    };
    setSaving(true);
    const res =
      mode === "create"
        ? await createDriverProfile(input)
        : await updateDriverProfile(input);
    setSaving(false);
    if (res.ok) {
      if (mode === "create") {
        toast.success("Profile created — one more step: your documents.");
        onCreated?.();
      } else {
        toast.success("Profile saved");
      }
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Who you are */}
      <fieldset className="card space-y-4 p-5">
        <legend className="label px-1">About you</legend>
        <div>
          <label className="label" htmlFor="drv-name">
            Display name
          </label>
          <input
            id="drv-name"
            className="input"
            required
            minLength={2}
            maxLength={40}
            placeholder="What riders will call you"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="drv-bio">
            Bio (optional)
          </label>
          <textarea
            id="drv-bio"
            rows={3}
            className="input"
            placeholder="Years driving, areas you know best, languages…"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="drv-parish">
              Parish
            </label>
            <select
              id="drv-parish"
              className="input"
              required
              value={parish}
              onChange={(e) => setParish(e.target.value)}
            >
              <option value="">Select…</option>
              {JAMAICA_PARISHES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="drv-city">
              Town / area (optional)
            </label>
            <input
              id="drv-city"
              className="input"
              maxLength={80}
              placeholder="e.g. Half-Way Tree"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-3">
          <p className="label">Face photo (public)</p>
          {facePhotoUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- uploaded media served by our media route
            <img
              src={facePhotoUrl}
              alt="Your face photo"
              className="h-28 w-28 rounded-full border border-hairline object-cover"
            />
          )}
          <FileUploadButton
            kind="driver"
            accept="image/jpeg,image/png,image/webp"
            label={facePhotoUrl ? "Replace face photo" : "Upload face photo"}
            onUploaded={(url) => setFacePhotoUrl(url)}
          />
          <p className="text-xs leading-5 text-faint">
            Riders see this before they board — use a clear, recent photo of
            your face.
          </p>
        </div>
      </fieldset>

      {/* The vehicle */}
      <fieldset className="card space-y-4 p-5">
        <legend className="label px-1">Your vehicle</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="drv-make">
              Make
            </label>
            <input
              id="drv-make"
              className="input"
              required
              maxLength={40}
              placeholder="Toyota"
              value={vehicleMake}
              onChange={(e) => setVehicleMake(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="drv-model">
              Model
            </label>
            <input
              id="drv-model"
              className="input"
              required
              maxLength={40}
              placeholder="Probox"
              value={vehicleModel}
              onChange={(e) => setVehicleModel(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="drv-year">
              Year (optional)
            </label>
            <input
              id="drv-year"
              type="number"
              min={1980}
              max={2035}
              className="input"
              placeholder="2018"
              value={vehicleYear}
              onChange={(e) => setVehicleYear(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="drv-color">
              Colour
            </label>
            <input
              id="drv-color"
              className="input"
              required
              maxLength={30}
              placeholder="White"
              value={vehicleColor}
              onChange={(e) => setVehicleColor(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="drv-plate">
            Licence plate
          </label>
          <input
            id="drv-plate"
            className="input uppercase sm:max-w-56"
            required
            minLength={2}
            maxLength={12}
            placeholder="1234 GK"
            value={vehiclePlate}
            onChange={(e) => setVehiclePlate(e.target.value)}
          />
          <p className="mt-1.5 text-xs leading-5 text-faint">
            Never shown publicly — riders only see it once you&apos;re matched,
            so they can check the plate before boarding.
          </p>
        </div>
        <div className="space-y-3">
          <p className="label">Vehicle photo (public)</p>
          {vehiclePhotoUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- uploaded media served by our media route
            <img
              src={vehiclePhotoUrl}
              alt="Your vehicle"
              className="h-32 w-48 rounded-xl border border-hairline object-cover"
            />
          )}
          <FileUploadButton
            kind="driver"
            accept="image/jpeg,image/png,image/webp"
            label={vehiclePhotoUrl ? "Replace vehicle photo" : "Upload vehicle photo"}
            onUploaded={(url) => setVehiclePhotoUrl(url)}
          />
        </div>
      </fieldset>

      {/* Fare guidance */}
      <fieldset className="card space-y-4 p-5">
        <legend className="label px-1">Your rates (optional)</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="drv-perkm">
              Per km (USD)
            </label>
            <input
              id="drv-perkm"
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              className="input"
              value={perKm}
              onChange={(e) => setPerKm(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="drv-minfare">
              Minimum fare (USD)
            </label>
            <input
              id="drv-minfare"
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              className="input"
              value={minFare}
              onChange={(e) => setMinFare(e.target.value)}
            />
          </div>
        </div>
        <p className="text-xs leading-5 text-faint">
          Guidance only — shown on your profile so riders pitch realistic
          offers. Leave at 0 to price every ride by offer.
        </p>
      </fieldset>

      <button type="submit" className="btn-primary w-full" disabled={saving}>
        {saving
          ? "Saving…"
          : mode === "create"
            ? "Create driver profile"
            : "Save changes"}
      </button>
    </form>
  );
}
