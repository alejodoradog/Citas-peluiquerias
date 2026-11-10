import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ShopLocation, ShopProfile } from "../dominio/profile";

// D-57. Sessions update only the barbershop columns granted to them, RLS
// keeps them to their own barbershops, and the filter by id keeps a second
// barbershop of the same owner out. The database checks that the logo and
// the cover are keys of their own folder (add_barbershop_profile_rules).

export type SavedShopProfile = {
  name: string;
  address: string | null;
  locality: string | null;
  whatsappPhone: string | null;
  location: ShopLocation | null;
  logoPath: string | null;
  coverPath: string | null;
};

export type ShopImageKind = "logo" | "cover";

const IMAGE_COLUMN = {
  logo: "logo_path",
  cover: "cover_photo_path",
} as const satisfies Record<ShopImageKind, string>;

export async function getShopProfile(
  barbershopId: string,
): Promise<SavedShopProfile> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("barbershops")
    .select(
      "name, address, locality, whatsapp_phone, latitude, longitude, logo_path, cover_photo_path",
    )
    .eq("id", barbershopId)
    .single();
  if (error) throw error;
  return {
    name: data.name,
    address: data.address,
    locality: data.locality,
    whatsappPhone: data.whatsapp_phone,
    // The database keeps both or neither (barbershops_coordinates_together).
    location:
      data.latitude !== null && data.longitude !== null
        ? { latitude: data.latitude, longitude: data.longitude }
        : null,
    logoPath: data.logo_path,
    coverPath: data.cover_photo_path,
  };
}

// False when nothing was written: RLS hid the row, or the database refused
// a value. A new logo or cover is only written when given.
export async function updateShopProfile(
  barbershopId: string,
  profile: ShopProfile,
  images: { logoPath?: string; coverPath?: string },
): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("barbershops")
    .update({
      name: profile.name,
      address: profile.address,
      locality: profile.locality,
      whatsapp_phone: profile.whatsappPhone,
      latitude: profile.location?.latitude ?? null,
      longitude: profile.location?.longitude ?? null,
      ...(images.logoPath ? { logo_path: images.logoPath } : {}),
      ...(images.coverPath ? { cover_photo_path: images.coverPath } : {}),
    })
    .eq("id", barbershopId)
    .select("id");
  if (error) return false;
  return data.length === 1;
}

// "Quitar logo" / "Quitar portada": empties the column only while it still
// points at `path`, so a removal that crosses a save of a new image never
// drops the new one. True when this call emptied it.
export async function clearShopImage(
  barbershopId: string,
  kind: ShopImageKind,
  path: string,
): Promise<boolean> {
  const column = IMAGE_COLUMN[kind];
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("barbershops")
    .update(kind === "logo" ? { logo_path: null } : { cover_photo_path: null })
    .eq("id", barbershopId)
    .eq(column, path)
    .select("id");
  if (error) return false;
  return data.length === 1;
}
