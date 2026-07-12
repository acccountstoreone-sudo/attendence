-- Seed Historical & Recent Attendance Records for HQ & Branch Dashboard Charts
-- Specification: Generates check-ins across the last 10 days and current year (2026)
-- so that the HQ Dashboard LineChart (Monthly) and AreaChart (Last 10 days) display rich, dynamic curves.

DO $$
DECLARE
    emp RECORD;
    i INTEGER;
    log_date TIMESTAMPTZ;
    check_in_t TIMESTAMPTZ;
    check_out_t TIMESTAMPTZ;
    stat public.attendance_status;
    random_minutes INTEGER;
BEGIN
    -- 1. Loop through all active employees and branch managers
    FOR emp IN 
        SELECT id, branch_id FROM public.profiles 
        WHERE role IN ('employee', 'branch_manager') AND branch_id IS NOT NULL
    LOOP
        -- A. Generate records for the last 10 days (For AreaChart / Weekly Trend)
        FOR i IN 0..9 LOOP
            log_date := DATE_TRUNC('day', NOW() - (i || ' days')::INTERVAL) + INTERVAL '9 hours';
            
            -- Skip if a record already exists for this employee on this day
            IF NOT EXISTS (
                SELECT 1 FROM public.attendance_records 
                WHERE employee_id = emp.id 
                  AND check_in_time >= DATE_TRUNC('day', NOW() - (i || ' days')::INTERVAL)
                  AND check_in_time < DATE_TRUNC('day', NOW() - (i || ' days')::INTERVAL) + INTERVAL '1 day'
            ) THEN
                -- Randomize status slightly (mostly present, some late)
                IF (i + emp.id::text::length) % 7 = 0 THEN
                    stat := 'late';
                    random_minutes := 35; -- 35 mins late
                ELSIF (i + emp.id::text::length) % 11 = 0 THEN
                    stat := 'half_day';
                    random_minutes := 10;
                ELSE
                    stat := 'present';
                    random_minutes := -5; -- 5 mins early
                END IF;

                check_in_t := log_date + (random_minutes || ' minutes')::INTERVAL;
                check_out_t := check_in_t + INTERVAL '8 hours' + ((i % 4) * 15 || ' minutes')::INTERVAL;

                INSERT INTO public.attendance_records (
                    employee_id,
                    branch_id,
                    check_in_time,
                    check_out_time,
                    check_in_lat,
                    check_in_lng,
                    check_out_lat,
                    check_out_lng,
                    face_match_score,
                    status,
                    overtime_minutes,
                    is_manual_override
                ) VALUES (
                    emp.id,
                    emp.branch_id,
                    check_in_t,
                    check_out_t,
                    23.8103 + (RANDOM() * 0.005),
                    90.4125 + (RANDOM() * 0.005),
                    23.8103 + (RANDOM() * 0.005),
                    90.4125 + (RANDOM() * 0.005),
                    0.96 + (RANDOM() * 0.03),
                    stat,
                    CASE WHEN i % 3 = 0 THEN 45 ELSE 0 END,
                    false
                );
            END IF;
        END LOOP;

        -- B. Generate records across previous months of the current year (Jan to Last Month)
        -- This ensures the Monthly Trend LineChart has a continuous curve across the year
        FOR i IN 1..180 BY 3 LOOP
            log_date := DATE_TRUNC('day', NOW() - (i || ' days')::INTERVAL) + INTERVAL '9 hours';
            
            -- Only insert if it falls within the current year and doesn't exist
            IF EXTRACT(YEAR FROM log_date) = EXTRACT(YEAR FROM NOW()) AND NOT EXISTS (
                SELECT 1 FROM public.attendance_records 
                WHERE employee_id = emp.id 
                  AND check_in_time >= DATE_TRUNC('day', log_date)
                  AND check_in_time < DATE_TRUNC('day', log_date) + INTERVAL '1 day'
            ) THEN
                IF i % 8 = 0 THEN
                    stat := 'late';
                    random_minutes := 25;
                ELSE
                    stat := 'present';
                    random_minutes := -10;
                END IF;

                check_in_t := log_date + (random_minutes || ' minutes')::INTERVAL;
                check_out_t := check_in_t + INTERVAL '8 hours';

                INSERT INTO public.attendance_records (
                    employee_id,
                    branch_id,
                    check_in_time,
                    check_out_time,
                    check_in_lat,
                    check_in_lng,
                    status,
                    face_match_score
                ) VALUES (
                    emp.id,
                    emp.branch_id,
                    check_in_t,
                    check_out_t,
                    23.8103,
                    90.4125,
                    stat,
                    0.98
                );
            END IF;
        END LOOP;
    END LOOP;
END $$;
