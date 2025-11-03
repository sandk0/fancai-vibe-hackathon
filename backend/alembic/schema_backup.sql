--
-- PostgreSQL database dump
--

-- Dumped from database version 15.7
-- Dumped by pg_dump version 15.7

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: descriptiontype; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.descriptiontype AS ENUM (
    'LOCATION',
    'CHARACTER',
    'ATMOSPHERE',
    'OBJECT',
    'ACTION'
);


--
-- Name: subscriptionplan; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.subscriptionplan AS ENUM (
    'FREE',
    'PREMIUM',
    'ULTIMATE'
);


--
-- Name: subscriptionstatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.subscriptionstatus AS ENUM (
    'ACTIVE',
    'EXPIRED',
    'CANCELLED',
    'PENDING'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: alembic_version; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alembic_version (
    version_num character varying(32) NOT NULL
);


--
-- Name: books; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.books (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    title character varying(500) NOT NULL,
    author character varying(255),
    genre character varying(50) NOT NULL,
    language character varying(10) NOT NULL,
    file_path character varying(1000) NOT NULL,
    file_format character varying(10) NOT NULL,
    file_size integer NOT NULL,
    cover_image character varying(1000),
    description text,
    total_pages integer NOT NULL,
    estimated_reading_time integer NOT NULL,
    is_parsed boolean NOT NULL,
    parsing_progress integer NOT NULL,
    parsing_error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_accessed timestamp with time zone,
    book_metadata jsonb,
    CONSTRAINT check_book_format CHECK (((file_format)::text = ANY ((ARRAY['epub'::character varying, 'fb2'::character varying])::text[]))),
    CONSTRAINT check_book_genre CHECK (((genre)::text = ANY ((ARRAY['fantasy'::character varying, 'detective'::character varying, 'science_fiction'::character varying, 'historical'::character varying, 'romance'::character varying, 'thriller'::character varying, 'horror'::character varying, 'classic'::character varying, 'other'::character varying])::text[])))
);


--
-- Name: chapters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chapters (
    id uuid NOT NULL,
    book_id uuid NOT NULL,
    chapter_number integer NOT NULL,
    title character varying(500),
    content text NOT NULL,
    html_content text,
    word_count integer NOT NULL,
    estimated_reading_time integer NOT NULL,
    is_description_parsed boolean NOT NULL,
    descriptions_found integer NOT NULL,
    parsing_progress integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    parsed_at timestamp with time zone
);


--
-- Name: descriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.descriptions (
    id uuid NOT NULL,
    chapter_id uuid NOT NULL,
    type public.descriptiontype NOT NULL,
    content text NOT NULL,
    context text,
    confidence_score double precision NOT NULL,
    position_in_chapter integer NOT NULL,
    word_count integer NOT NULL,
    is_suitable_for_generation boolean NOT NULL,
    priority_score double precision NOT NULL,
    entities_mentioned text,
    emotional_tone character varying(50),
    complexity_level character varying(20),
    image_generated boolean NOT NULL,
    generation_requested boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: generated_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.generated_images (
    id uuid NOT NULL,
    description_id uuid NOT NULL,
    service_used character varying(50) NOT NULL,
    status character varying(20) NOT NULL,
    image_url character varying(2000),
    local_path character varying(1000),
    prompt_used text NOT NULL,
    generation_time_seconds double precision,
    file_size integer,
    image_width integer,
    image_height integer,
    file_format character varying(10),
    quality_score double precision,
    is_moderated boolean NOT NULL,
    moderation_notes text,
    view_count integer NOT NULL,
    download_count integer NOT NULL,
    error_message text,
    retry_count integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    generated_at timestamp with time zone,
    user_id uuid NOT NULL,
    generation_parameters jsonb,
    moderation_result jsonb,
    CONSTRAINT check_image_service CHECK (((service_used)::text = ANY ((ARRAY['pollinations'::character varying, 'openai_dalle'::character varying, 'midjourney'::character varying, 'stable_diffusion'::character varying])::text[]))),
    CONSTRAINT check_image_status CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'generating'::character varying, 'completed'::character varying, 'failed'::character varying, 'moderated'::character varying])::text[])))
);


--
-- Name: reading_progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reading_progress (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    book_id uuid NOT NULL,
    current_chapter integer NOT NULL,
    current_page integer NOT NULL,
    current_position integer NOT NULL,
    reading_time_minutes integer NOT NULL,
    reading_speed_wpm double precision NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_read_at timestamp with time zone DEFAULT now() NOT NULL,
    reading_location_cfi character varying(500),
    scroll_offset_percent double precision DEFAULT 0.0 NOT NULL
);


--
-- Name: reading_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reading_sessions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    book_id uuid NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    ended_at timestamp with time zone,
    duration_minutes integer NOT NULL,
    start_position integer NOT NULL,
    end_position integer NOT NULL,
    pages_read integer NOT NULL,
    device_type character varying(50),
    is_active boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: reading_sessions_daily_stats; Type: MATERIALIZED VIEW; Schema: public; Owner: -
--

CREATE MATERIALIZED VIEW public.reading_sessions_daily_stats AS
 SELECT date(reading_sessions.started_at) AS date,
    count(*) AS total_sessions,
    count(DISTINCT reading_sessions.user_id) AS active_users,
    avg(reading_sessions.duration_minutes) AS avg_duration_minutes,
    sum(reading_sessions.duration_minutes) AS total_reading_minutes,
    avg((reading_sessions.end_position - reading_sessions.start_position)) AS avg_progress_percent,
    count(*) FILTER (WHERE (reading_sessions.duration_minutes >= 10)) AS sessions_over_10min,
    count(*) FILTER (WHERE (reading_sessions.is_active = false)) AS completed_sessions
   FROM public.reading_sessions
  WHERE (reading_sessions.started_at >= (CURRENT_DATE - '90 days'::interval))
  GROUP BY (date(reading_sessions.started_at))
  ORDER BY (date(reading_sessions.started_at)) DESC
  WITH NO DATA;


--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscriptions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    plan public.subscriptionplan NOT NULL,
    status public.subscriptionstatus NOT NULL,
    start_date timestamp with time zone DEFAULT now() NOT NULL,
    end_date timestamp with time zone,
    auto_renewal boolean NOT NULL,
    books_uploaded integer NOT NULL,
    images_generated_month integer NOT NULL,
    last_reset_date timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_reading_patterns; Type: MATERIALIZED VIEW; Schema: public; Owner: -
--

CREATE MATERIALIZED VIEW public.user_reading_patterns AS
 SELECT reading_sessions.user_id,
    count(*) AS total_sessions,
    avg(reading_sessions.duration_minutes) AS avg_session_duration,
    sum(reading_sessions.duration_minutes) AS total_reading_time,
    avg((reading_sessions.end_position - reading_sessions.start_position)) AS avg_progress_per_session,
    (EXTRACT(hour FROM reading_sessions.started_at))::integer AS preferred_reading_hour,
    count(*) AS sessions_at_hour
   FROM public.reading_sessions
  WHERE ((reading_sessions.is_active = false) AND (reading_sessions.started_at >= (CURRENT_DATE - '30 days'::interval)))
  GROUP BY reading_sessions.user_id, ((EXTRACT(hour FROM reading_sessions.started_at))::integer)
  ORDER BY reading_sessions.user_id, (count(*)) DESC
  WITH NO DATA;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    full_name character varying(255),
    is_active boolean NOT NULL,
    is_verified boolean NOT NULL,
    is_admin boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_login timestamp with time zone
);


--
-- Name: alembic_version alembic_version_pkc; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alembic_version
    ADD CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num);


--
-- Name: books books_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.books
    ADD CONSTRAINT books_pkey PRIMARY KEY (id);


--
-- Name: chapters chapters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chapters
    ADD CONSTRAINT chapters_pkey PRIMARY KEY (id);


--
-- Name: descriptions descriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.descriptions
    ADD CONSTRAINT descriptions_pkey PRIMARY KEY (id);


--
-- Name: generated_images generated_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.generated_images
    ADD CONSTRAINT generated_images_pkey PRIMARY KEY (id);


--
-- Name: reading_progress reading_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reading_progress
    ADD CONSTRAINT reading_progress_pkey PRIMARY KEY (id);


--
-- Name: reading_sessions reading_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reading_sessions
    ADD CONSTRAINT reading_sessions_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_books_metadata_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_books_metadata_gin ON public.books USING gin (book_metadata);


--
-- Name: idx_books_user_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_books_user_created ON public.books USING btree (user_id, created_at);


--
-- Name: idx_books_user_unparsed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_books_user_unparsed ON public.books USING btree (user_id, is_parsed) WHERE (is_parsed = false);


--
-- Name: idx_chapters_book_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chapters_book_number ON public.chapters USING btree (book_id, chapter_number);


--
-- Name: idx_descriptions_chapter_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_descriptions_chapter_priority ON public.descriptions USING btree (chapter_id, priority_score);


--
-- Name: idx_generated_images_description; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_generated_images_description ON public.generated_images USING btree (description_id);


--
-- Name: idx_generated_images_moderation_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_generated_images_moderation_gin ON public.generated_images USING gin (moderation_result);


--
-- Name: idx_generated_images_params_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_generated_images_params_gin ON public.generated_images USING gin (generation_parameters);


--
-- Name: idx_images_status_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_images_status_created ON public.generated_images USING btree (status, created_at);


--
-- Name: idx_reading_progress_last_read; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reading_progress_last_read ON public.reading_progress USING btree (user_id, last_read_at);


--
-- Name: idx_reading_progress_user_book; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reading_progress_user_book ON public.reading_progress USING btree (user_id, book_id);


--
-- Name: idx_reading_sessions_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reading_sessions_active ON public.reading_sessions USING btree (user_id, is_active) WHERE (is_active = true);


--
-- Name: idx_reading_sessions_book; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reading_sessions_book ON public.reading_sessions USING btree (book_id, started_at);


--
-- Name: idx_reading_sessions_book_stats; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reading_sessions_book_stats ON public.reading_sessions USING btree (book_id, started_at, is_active);


--
-- Name: idx_reading_sessions_cleanup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reading_sessions_cleanup ON public.reading_sessions USING btree (is_active, ended_at, started_at);


--
-- Name: idx_reading_sessions_daily_stats_date; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_reading_sessions_daily_stats_date ON public.reading_sessions_daily_stats USING btree (date);


--
-- Name: idx_reading_sessions_user_active_partial; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reading_sessions_user_active_partial ON public.reading_sessions USING btree (user_id) WHERE (is_active = true);


--
-- Name: idx_reading_sessions_user_started; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reading_sessions_user_started ON public.reading_sessions USING btree (user_id, started_at);


--
-- Name: idx_reading_sessions_weekly; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reading_sessions_weekly ON public.reading_sessions USING btree (user_id, started_at, duration_minutes);


--
-- Name: idx_reading_sessions_weekly_stats; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reading_sessions_weekly_stats ON public.reading_sessions USING btree (user_id, started_at, duration_minutes, is_active);


--
-- Name: idx_subscriptions_user_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_user_status ON public.subscriptions USING btree (user_id, status);


--
-- Name: idx_user_reading_patterns_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_reading_patterns_user ON public.user_reading_patterns USING btree (user_id);


--
-- Name: ix_books_author; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_books_author ON public.books USING btree (author);


--
-- Name: ix_books_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_books_id ON public.books USING btree (id);


--
-- Name: ix_books_title; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_books_title ON public.books USING btree (title);


--
-- Name: ix_books_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_books_user_id ON public.books USING btree (user_id);


--
-- Name: ix_chapters_book_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_chapters_book_id ON public.chapters USING btree (book_id);


--
-- Name: ix_chapters_chapter_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_chapters_chapter_number ON public.chapters USING btree (chapter_number);


--
-- Name: ix_chapters_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_chapters_id ON public.chapters USING btree (id);


--
-- Name: ix_descriptions_chapter_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_descriptions_chapter_id ON public.descriptions USING btree (chapter_id);


--
-- Name: ix_descriptions_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_descriptions_id ON public.descriptions USING btree (id);


--
-- Name: ix_descriptions_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_descriptions_type ON public.descriptions USING btree (type);


--
-- Name: ix_generated_images_description_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_generated_images_description_id ON public.generated_images USING btree (description_id);


--
-- Name: ix_generated_images_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_generated_images_id ON public.generated_images USING btree (id);


--
-- Name: ix_generated_images_service_used; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_generated_images_service_used ON public.generated_images USING btree (service_used);


--
-- Name: ix_generated_images_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_generated_images_status ON public.generated_images USING btree (status);


--
-- Name: ix_generated_images_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_generated_images_user_id ON public.generated_images USING btree (user_id);


--
-- Name: ix_reading_progress_book_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_reading_progress_book_id ON public.reading_progress USING btree (book_id);


--
-- Name: ix_reading_progress_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_reading_progress_id ON public.reading_progress USING btree (id);


--
-- Name: ix_reading_progress_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_reading_progress_user_id ON public.reading_progress USING btree (user_id);


--
-- Name: ix_reading_sessions_book_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_reading_sessions_book_id ON public.reading_sessions USING btree (book_id);


--
-- Name: ix_reading_sessions_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_reading_sessions_id ON public.reading_sessions USING btree (id);


--
-- Name: ix_reading_sessions_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_reading_sessions_is_active ON public.reading_sessions USING btree (is_active);


--
-- Name: ix_reading_sessions_started_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_reading_sessions_started_at ON public.reading_sessions USING btree (started_at);


--
-- Name: ix_reading_sessions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_reading_sessions_user_id ON public.reading_sessions USING btree (user_id);


--
-- Name: ix_subscriptions_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_subscriptions_id ON public.subscriptions USING btree (id);


--
-- Name: ix_subscriptions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_subscriptions_user_id ON public.subscriptions USING btree (user_id);


--
-- Name: ix_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_users_email ON public.users USING btree (email);


--
-- Name: ix_users_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_users_id ON public.users USING btree (id);


--
-- Name: books books_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.books
    ADD CONSTRAINT books_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: chapters chapters_book_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chapters
    ADD CONSTRAINT chapters_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.books(id);


--
-- Name: descriptions descriptions_chapter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.descriptions
    ADD CONSTRAINT descriptions_chapter_id_fkey FOREIGN KEY (chapter_id) REFERENCES public.chapters(id);


--
-- Name: generated_images generated_images_description_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.generated_images
    ADD CONSTRAINT generated_images_description_id_fkey FOREIGN KEY (description_id) REFERENCES public.descriptions(id);


--
-- Name: generated_images generated_images_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.generated_images
    ADD CONSTRAINT generated_images_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: reading_progress reading_progress_book_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reading_progress
    ADD CONSTRAINT reading_progress_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.books(id);


--
-- Name: reading_progress reading_progress_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reading_progress
    ADD CONSTRAINT reading_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: reading_sessions reading_sessions_book_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reading_sessions
    ADD CONSTRAINT reading_sessions_book_id_fkey FOREIGN KEY (book_id) REFERENCES public.books(id) ON DELETE CASCADE;


--
-- Name: reading_sessions reading_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reading_sessions
    ADD CONSTRAINT reading_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: subscriptions subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- PostgreSQL database dump complete
--

