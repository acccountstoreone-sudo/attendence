-- Add email column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- Create a function to backfill email from auth.users (to be run manually if needed)
-- UPDATE public.profiles p SET email = (SELECT email FROM auth.users u WHERE u.id = p.id);

-- Update the existing trigger function to insert email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, email, role, branch_id)
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
        new.email,
        COALESCE((new.raw_user_meta_data->>'role')::public.user_role, 'employee'::public.user_role),
        (new.raw_user_meta_data->>'branch_id')::uuid
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
