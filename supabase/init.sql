-- Run this in Supabase SQL editor to create tables used by IT Hub

-- Enable the pgcrypto extension if not already enabled (required for gen_random_uuid())
create extension if not exists pgcrypto;

-- Stores generic events: vercel deployments, manual incidents, etc.
create table if not exists it_hub_events (
  id uuid default gen_random_uuid() primary key,
  type text not null,
  payload jsonb not null,
  created_at timestamptz default now()
);

-- Stores incidents tracked locally (mirror of BetterStack incidents)
create table if not exists it_hub_incidents (
  id uuid default gen_random_uuid() primary key,
  external_id text,
  title text not null,
  status text not null,
  details text,
  metadata jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
