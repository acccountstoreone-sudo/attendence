CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$ 
BEGIN 
  INSERT INTO public.profiles (id, full_name, role, branch_id) 
  VALUES ( 
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), 
    COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'employee'::public.user_role), 
    NULLIF(NEW.raw_user_meta_data->>'branch_id', '')::uuid 
  ); 
  RETURN NEW; 
END; 
$$ LANGUAGE plpgsql SECURITY DEFINER;