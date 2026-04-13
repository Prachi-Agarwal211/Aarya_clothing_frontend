--
-- PostgreSQL database dump
--

\restrict tGO7KgAReH59OUTiJW2hctbwU9zvfjHeJGpaJFqmyOezVt2NAf2pO4YT6VS8RW6

-- Dumped from database version 15.17 (Debian 15.17-1.pgdg12+1)
-- Dumped by pg_dump version 15.17 (Debian 15.17-1.pgdg12+1)

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
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: vector; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;


--
-- Name: EXTENSION vector; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION vector IS 'vector data type and ivfflat and hnsw access methods';


--
-- Name: address_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.address_type AS ENUM (
    'shipping',
    'billing',
    'both'
);


ALTER TYPE public.address_type OWNER TO postgres;

--
-- Name: chat_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.chat_status AS ENUM (
    'open',
    'assigned',
    'resolved',
    'closed'
);


ALTER TYPE public.chat_status OWNER TO postgres;

--
-- Name: discount_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.discount_type AS ENUM (
    'percentage',
    'fixed'
);


ALTER TYPE public.discount_type OWNER TO postgres;

--
-- Name: order_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.order_status AS ENUM (
    'confirmed',
    'shipped',
    'delivered',
    'cancelled'
);


ALTER TYPE public.order_status OWNER TO postgres;

--
-- Name: return_reason; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.return_reason AS ENUM (
    'defective',
    'wrong_item',
    'not_as_described',
    'size_issue',
    'color_issue',
    'changed_mind',
    'other'
);


ALTER TYPE public.return_reason OWNER TO postgres;

--
-- Name: return_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.return_status AS ENUM (
    'requested',
    'approved',
    'rejected',
    'received',
    'refunded',
    'completed'
);


ALTER TYPE public.return_status OWNER TO postgres;

--
-- Name: return_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.return_type AS ENUM (
    'return',
    'exchange'
);


ALTER TYPE public.return_type OWNER TO postgres;

--
-- Name: sender_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.sender_type AS ENUM (
    'customer',
    'staff',
    'admin',
    'system',
    'ai'
);


ALTER TYPE public.sender_type OWNER TO postgres;

--
-- Name: user_role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.user_role AS ENUM (
    'admin',
    'staff',
    'customer',
    'super_admin'
);


ALTER TYPE public.user_role OWNER TO postgres;

--
-- Name: cleanup_expired_otps(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.cleanup_expired_otps() RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM otps WHERE expires_at < CURRENT_TIMESTAMP;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;


ALTER FUNCTION public.cleanup_expired_otps() OWNER TO postgres;

--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.set_updated_at() OWNER TO postgres;

--
-- Name: update_product_rating(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_product_rating() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE products 
    SET average_rating = (
        SELECT COALESCE(AVG(rating)::DECIMAL(3,2), 0) 
        FROM reviews 
        WHERE product_id = COALESCE(NEW.product_id, OLD.product_id) AND is_approved = true
    ),
    review_count = (
        SELECT COUNT(*) 
        FROM reviews 
        WHERE product_id = COALESCE(NEW.product_id, OLD.product_id) AND is_approved = true
    )
    WHERE id = COALESCE(NEW.product_id, OLD.product_id);
    RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION public.update_product_rating() OWNER TO postgres;

--
-- Name: update_product_total_stock(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_product_total_stock() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        UPDATE products 
        SET total_stock = (
            SELECT COALESCE(SUM(quantity), 0) 
            FROM inventory 
            WHERE product_id = COALESCE(NEW.product_id, OLD.product_id)
        )
        WHERE id = COALESCE(NEW.product_id, OLD.product_id);
        RETURN COALESCE(NEW, OLD);
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE products 
        SET total_stock = (
            SELECT COALESCE(SUM(quantity), 0) 
            FROM inventory 
            WHERE product_id = OLD.product_id
        )
        WHERE id = OLD.product_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;


ALTER FUNCTION public.update_product_total_stock() OWNER TO postgres;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: addresses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.addresses (
    id integer NOT NULL,
    user_id integer NOT NULL,
    address_type public.address_type DEFAULT 'shipping'::public.address_type,
    full_name character varying(100) NOT NULL,
    phone character varying(20) NOT NULL,
    email character varying(255),
    address_line1 character varying(255) NOT NULL,
    address_line2 character varying(255),
    city character varying(100) NOT NULL,
    state character varying(100) NOT NULL,
    postal_code character varying(20) NOT NULL,
    country character varying(100) DEFAULT 'India'::character varying,
    landmark character varying(255),
    is_default boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.addresses OWNER TO postgres;

--
-- Name: addresses_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.addresses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.addresses_id_seq OWNER TO postgres;

--
-- Name: addresses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.addresses_id_seq OWNED BY public.addresses.id;


--
-- Name: ai_messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ai_messages (
    id integer NOT NULL,
    session_id character varying(100) NOT NULL,
    role character varying(20) NOT NULL,
    content text,
    image_urls jsonb,
    tool_calls jsonb,
    tool_results jsonb,
    tokens_in integer DEFAULT 0,
    tokens_out integer DEFAULT 0,
    cost numeric(12,8) DEFAULT 0,
    model_used character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.ai_messages OWNER TO postgres;

--
-- Name: ai_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.ai_messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.ai_messages_id_seq OWNER TO postgres;

--
-- Name: ai_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.ai_messages_id_seq OWNED BY public.ai_messages.id;


--
-- Name: ai_sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ai_sessions (
    id integer NOT NULL,
    session_id character varying(100) NOT NULL,
    user_id integer,
    role character varying(20) DEFAULT 'customer'::character varying NOT NULL,
    total_tokens_in integer DEFAULT 0,
    total_tokens_out integer DEFAULT 0,
    total_cost numeric(12,8) DEFAULT 0,
    message_count integer DEFAULT 0,
    context_summary text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    last_activity timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.ai_sessions OWNER TO postgres;

--
-- Name: ai_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.ai_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.ai_sessions_id_seq OWNER TO postgres;

--
-- Name: ai_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.ai_sessions_id_seq OWNED BY public.ai_sessions.id;


--
-- Name: ai_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ai_settings (
    id integer NOT NULL,
    key character varying(100) NOT NULL,
    value text,
    description text,
    is_secret boolean DEFAULT false,
    category character varying(50) DEFAULT 'general'::character varying,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_by integer
);


ALTER TABLE public.ai_settings OWNER TO postgres;

--
-- Name: ai_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.ai_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.ai_settings_id_seq OWNER TO postgres;

--
-- Name: ai_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.ai_settings_id_seq OWNED BY public.ai_settings.id;


--
-- Name: analytics_cache; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.analytics_cache (
    id integer NOT NULL,
    cache_key character varying(255) NOT NULL,
    data jsonb NOT NULL,
    period_start timestamp without time zone,
    period_end timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    expires_at timestamp without time zone
);


ALTER TABLE public.analytics_cache OWNER TO postgres;

--
-- Name: analytics_cache_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.analytics_cache_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.analytics_cache_id_seq OWNER TO postgres;

--
-- Name: analytics_cache_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.analytics_cache_id_seq OWNED BY public.analytics_cache.id;


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_logs (
    id integer NOT NULL,
    user_id integer,
    action character varying(100) NOT NULL,
    resource_type character varying(50) NOT NULL,
    resource_id integer,
    changes jsonb,
    description text,
    ip_address character varying(45),
    user_agent character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.audit_logs OWNER TO postgres;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.audit_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.audit_logs_id_seq OWNER TO postgres;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;


--
-- Name: brands; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.brands (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    logo_url character varying(500),
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.brands OWNER TO postgres;

--
-- Name: brands_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.brands_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.brands_id_seq OWNER TO postgres;

--
-- Name: brands_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.brands_id_seq OWNED BY public.brands.id;


--
-- Name: collections; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.collections (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    slug character varying(100),
    description text,
    image_url character varying(500),
    is_active boolean DEFAULT true,
    is_featured boolean DEFAULT false,
    display_order integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.collections OWNER TO postgres;

--
-- Name: categories; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.categories AS
 SELECT collections.id,
    collections.name,
    collections.slug,
    collections.description,
    collections.image_url,
    collections.is_active,
    collections.is_featured,
    collections.display_order,
    collections.created_at,
    collections.updated_at
   FROM public.collections;


ALTER TABLE public.categories OWNER TO postgres;

--
-- Name: chat_messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.chat_messages (
    id integer NOT NULL,
    room_id integer NOT NULL,
    sender_id integer,
    sender_type public.sender_type DEFAULT 'customer'::public.sender_type,
    message text NOT NULL,
    is_read boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.chat_messages OWNER TO postgres;

--
-- Name: chat_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.chat_messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.chat_messages_id_seq OWNER TO postgres;

--
-- Name: chat_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.chat_messages_id_seq OWNED BY public.chat_messages.id;


--
-- Name: chat_rooms; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.chat_rooms (
    id integer NOT NULL,
    customer_id integer NOT NULL,
    customer_name character varying(100),
    customer_email character varying(255),
    assigned_to integer,
    subject character varying(255),
    status public.chat_status DEFAULT 'open'::public.chat_status,
    priority character varying(20) DEFAULT 'medium'::character varying,
    order_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    closed_at timestamp without time zone
);


ALTER TABLE public.chat_rooms OWNER TO postgres;

--
-- Name: chat_rooms_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.chat_rooms_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.chat_rooms_id_seq OWNER TO postgres;

--
-- Name: chat_rooms_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.chat_rooms_id_seq OWNED BY public.chat_rooms.id;


--
-- Name: chat_sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.chat_sessions (
    id character varying(50) NOT NULL,
    user_id integer,
    is_active boolean,
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


ALTER TABLE public.chat_sessions OWNER TO postgres;

--
-- Name: collections_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.collections_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.collections_id_seq OWNER TO postgres;

--
-- Name: collections_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.collections_id_seq OWNED BY public.collections.id;


--
-- Name: easebuzz_refunds; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.easebuzz_refunds (
    id integer NOT NULL,
    refund_id character varying(100) NOT NULL,
    original_transaction_id character varying(100) NOT NULL,
    amount numeric(10,2) NOT NULL,
    refund_reason text NOT NULL,
    status character varying(50) NOT NULL,
    easebuzz_refund_id character varying(100),
    easebuzz_status character varying(50),
    error_message text,
    error_code character varying(50),
    processed_by integer,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    completed_at timestamp with time zone
);


ALTER TABLE public.easebuzz_refunds OWNER TO postgres;

--
-- Name: easebuzz_refunds_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.easebuzz_refunds_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.easebuzz_refunds_id_seq OWNER TO postgres;

--
-- Name: easebuzz_refunds_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.easebuzz_refunds_id_seq OWNED BY public.easebuzz_refunds.id;


--
-- Name: easebuzz_transactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.easebuzz_transactions (
    id integer NOT NULL,
    transaction_id character varying(100) NOT NULL,
    easebuzz_order_id character varying(100) NOT NULL,
    txnid character varying(100) NOT NULL,
    amount numeric(10,2) NOT NULL,
    currency character varying(3) NOT NULL,
    payment_mode character varying(50),
    bank_ref_num character varying(100),
    card_category character varying(50),
    firstname character varying(100) NOT NULL,
    email character varying(255) NOT NULL,
    phone character varying(20) NOT NULL,
    productinfo text NOT NULL,
    address1 character varying(255),
    address2 character varying(255),
    city character varying(100),
    state character varying(100),
    country character varying(100),
    zipcode character varying(20),
    surl text NOT NULL,
    furl text NOT NULL,
    status character varying(50) NOT NULL,
    easebuzz_status character varying(50),
    payment_url text,
    error_message text,
    error_code character varying(50),
    udf1 character varying(255),
    udf2 character varying(255),
    udf3 character varying(255),
    udf4 character varying(255),
    udf5 character varying(255),
    user_id integer,
    order_id integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    completed_at timestamp with time zone
);


ALTER TABLE public.easebuzz_transactions OWNER TO postgres;

--
-- Name: easebuzz_transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.easebuzz_transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.easebuzz_transactions_id_seq OWNER TO postgres;

--
-- Name: easebuzz_transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.easebuzz_transactions_id_seq OWNED BY public.easebuzz_transactions.id;


--
-- Name: easebuzz_webhook_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.easebuzz_webhook_logs (
    id integer NOT NULL,
    webhook_id character varying(100) NOT NULL,
    event_type character varying(100) NOT NULL,
    payload json NOT NULL,
    signature character varying(512),
    processed boolean NOT NULL,
    processing_attempts integer NOT NULL,
    error_message text,
    transaction_id character varying(100),
    received_at timestamp with time zone DEFAULT now() NOT NULL,
    processed_at timestamp with time zone
);


ALTER TABLE public.easebuzz_webhook_logs OWNER TO postgres;

--
-- Name: easebuzz_webhook_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.easebuzz_webhook_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.easebuzz_webhook_logs_id_seq OWNER TO postgres;

--
-- Name: easebuzz_webhook_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.easebuzz_webhook_logs_id_seq OWNED BY public.easebuzz_webhook_logs.id;


--
-- Name: email_verifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.email_verifications (
    id integer NOT NULL,
    user_id integer NOT NULL,
    token character varying(255) NOT NULL,
    token_type character varying(20) DEFAULT 'email_verification'::character varying,
    expires_at timestamp without time zone NOT NULL,
    verified_at timestamp without time zone,
    ip_address character varying(45),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT email_verifications_token_type_check CHECK (((token_type)::text = ANY ((ARRAY['email_verification'::character varying, 'password_reset'::character varying])::text[])))
);


ALTER TABLE public.email_verifications OWNER TO postgres;

--
-- Name: email_verifications_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.email_verifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.email_verifications_id_seq OWNER TO postgres;

--
-- Name: email_verifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.email_verifications_id_seq OWNED BY public.email_verifications.id;


--
-- Name: inventory; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.inventory (
    id integer NOT NULL,
    product_id integer NOT NULL,
    sku character varying(100) NOT NULL,
    size character varying(50),
    color character varying(50),
    quantity integer DEFAULT 0,
    reserved_quantity integer DEFAULT 0,
    low_stock_threshold integer DEFAULT 10,
    cost_price numeric(10,2),
    variant_price numeric(10,2),
    description text,
    weight numeric(10,3),
    location character varying(100),
    barcode character varying(100),
    image_url character varying(500),
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    color_hex character varying(7),
    CONSTRAINT chk_inventory_quantity_non_negative CHECK ((quantity >= 0))
);


ALTER TABLE public.inventory OWNER TO postgres;

--
-- Name: inventory_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.inventory_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.inventory_id_seq OWNER TO postgres;

--
-- Name: inventory_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.inventory_id_seq OWNED BY public.inventory.id;


--
-- Name: inventory_movements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.inventory_movements (
    id integer NOT NULL,
    inventory_id integer NOT NULL,
    product_id integer NOT NULL,
    adjustment integer NOT NULL,
    reason character varying(50) NOT NULL,
    notes text,
    supplier character varying(255),
    cost_price numeric(10,2),
    performed_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.inventory_movements OWNER TO postgres;

--
-- Name: inventory_movements_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.inventory_movements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.inventory_movements_id_seq OWNER TO postgres;

--
-- Name: inventory_movements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.inventory_movements_id_seq OWNED BY public.inventory_movements.id;


--
-- Name: invoice_number_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.invoice_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.invoice_number_seq OWNER TO postgres;

--
-- Name: landing_config; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.landing_config (
    id integer NOT NULL,
    section character varying(100) NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true,
    updated_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.landing_config OWNER TO postgres;

--
-- Name: landing_config_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.landing_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.landing_config_id_seq OWNER TO postgres;

--
-- Name: landing_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.landing_config_id_seq OWNED BY public.landing_config.id;


--
-- Name: landing_images; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.landing_images (
    id integer NOT NULL,
    section character varying(100) NOT NULL,
    image_url character varying(500) NOT NULL,
    title character varying(255),
    subtitle character varying(255),
    link_url character varying(500),
    display_order integer DEFAULT 0,
    device_variant character varying(20) DEFAULT NULL::character varying,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.landing_images OWNER TO postgres;

--
-- Name: landing_images_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.landing_images_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.landing_images_id_seq OWNER TO postgres;

--
-- Name: landing_images_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.landing_images_id_seq OWNED BY public.landing_images.id;


--
-- Name: landing_products; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.landing_products (
    id integer NOT NULL,
    section character varying(50) NOT NULL,
    product_id integer NOT NULL,
    display_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_landing_products_section CHECK (((section)::text = ANY ((ARRAY['hero'::character varying, 'featured'::character varying, 'newArrivals'::character varying, 'trending'::character varying, 'collections'::character varying, 'sale'::character varying])::text[])))
);


ALTER TABLE public.landing_products OWNER TO postgres;

--
-- Name: landing_products_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.landing_products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.landing_products_id_seq OWNER TO postgres;

--
-- Name: landing_products_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.landing_products_id_seq OWNED BY public.landing_products.id;


--
-- Name: products; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.products (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    slug character varying(255),
    description text,
    short_description character varying(500),
    base_price numeric(10,2) NOT NULL,
    mrp numeric(10,2),
    category_id integer,
    brand character varying(100),
    hsn_code character varying(10),
    gst_rate numeric(5,2),
    is_taxable boolean DEFAULT true,
    average_rating numeric(3,2) DEFAULT 0,
    review_count integer DEFAULT 0,
    total_stock integer DEFAULT 0,
    is_active boolean DEFAULT true,
    is_featured boolean DEFAULT false,
    is_new_arrival boolean DEFAULT false,
    meta_title character varying(255),
    meta_description character varying(500),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    embedding public.vector(768),
    tags character varying(500),
    CONSTRAINT chk_products_mrp_gte_base_price CHECK (((mrp IS NULL) OR (mrp >= base_price))),
    CONSTRAINT chk_products_price_non_negative CHECK ((base_price >= (0)::numeric))
);


ALTER TABLE public.products OWNER TO postgres;

--
-- Name: low_stock_view; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.low_stock_view AS
 SELECT p.id,
    p.name,
    inv.sku,
    inv.quantity,
    inv.low_stock_threshold,
    (inv.low_stock_threshold - inv.quantity) AS shortage_amount
   FROM (public.products p
     JOIN public.inventory inv ON ((p.id = inv.product_id)))
  WHERE ((inv.quantity <= inv.low_stock_threshold) AND (p.is_active = true));


ALTER TABLE public.low_stock_view OWNER TO postgres;

--
-- Name: notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notifications (
    id integer NOT NULL,
    user_id integer NOT NULL,
    type character varying(50) NOT NULL,
    title character varying(255) NOT NULL,
    message text,
    is_read boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.notifications OWNER TO postgres;

--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.notifications_id_seq OWNER TO postgres;

--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- Name: order_details_view; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.order_details_view AS
SELECT
    NULL::integer AS id,
    NULL::integer AS user_id,
    NULL::character varying(255) AS customer_email,
    NULL::character varying(50) AS customer_username,
    NULL::character varying(100) AS customer_name,
    NULL::numeric(10,2) AS total_amount,
    NULL::public.order_status AS status,
    NULL::timestamp without time zone AS created_at,
    NULL::timestamp without time zone AS shipped_at,
    NULL::timestamp without time zone AS delivered_at,
    NULL::timestamp without time zone AS cancelled_at,
    NULL::bigint AS item_count;


ALTER TABLE public.order_details_view OWNER TO postgres;

--
-- Name: order_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.order_items (
    id integer NOT NULL,
    order_id integer NOT NULL,
    inventory_id integer NOT NULL,
    product_id integer,
    product_name character varying(255),
    sku character varying(100),
    size character varying(50),
    color character varying(50),
    hsn_code character varying(10),
    gst_rate numeric(5,2),
    quantity integer DEFAULT 1 NOT NULL,
    unit_price numeric(10,2) NOT NULL,
    price numeric(10,2) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_order_items_price_non_negative CHECK ((unit_price >= (0)::numeric)),
    CONSTRAINT chk_order_items_quantity_positive CHECK ((quantity > 0))
);


ALTER TABLE public.order_items OWNER TO postgres;

--
-- Name: order_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.order_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.order_items_id_seq OWNER TO postgres;

--
-- Name: order_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.order_items_id_seq OWNED BY public.order_items.id;


--
-- Name: order_tracking; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.order_tracking (
    id integer NOT NULL,
    order_id integer NOT NULL,
    status public.order_status NOT NULL,
    notes text,
    location character varying(255),
    updated_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.order_tracking OWNER TO postgres;

--
-- Name: order_tracking_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.order_tracking_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.order_tracking_id_seq OWNER TO postgres;

--
-- Name: order_tracking_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.order_tracking_id_seq OWNED BY public.order_tracking.id;


--
-- Name: orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.orders (
    id integer NOT NULL,
    user_id integer NOT NULL,
    invoice_number character varying(50),
    subtotal numeric(10,2) DEFAULT 0 NOT NULL,
    discount_applied numeric(10,2) DEFAULT 0,
    promo_code character varying(50),
    shipping_cost numeric(10,2) DEFAULT 0,
    gst_amount numeric(10,2) DEFAULT 0,
    cgst_amount numeric(10,2) DEFAULT 0,
    sgst_amount numeric(10,2) DEFAULT 0,
    igst_amount numeric(10,2) DEFAULT 0,
    place_of_supply character varying(50),
    customer_gstin character varying(15),
    total_amount numeric(10,2) NOT NULL,
    payment_method character varying(50),
    status public.order_status DEFAULT 'confirmed'::public.order_status,
    shipping_address_id integer,
    shipping_address text,
    billing_address_id integer,
    shipping_method character varying(50),
    tracking_number character varying(100),
    order_notes text,
    transaction_id character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    cancelled_at timestamp without time zone,
    cancellation_reason text,
    shipped_at timestamp without time zone,
    delivered_at timestamp without time zone,
    razorpay_order_id character varying(100),
    razorpay_payment_id character varying(100),
    cashfree_order_id character varying(100),
    cashfree_reference_id character varying(100),
    CONSTRAINT chk_orders_payment_method CHECK (((payment_method IS NULL) OR ((payment_method)::text = ANY ((ARRAY['cashfree'::character varying, 'razorpay'::character varying, 'easebuzz'::character varying, 'upi'::character varying, 'bank_transfer'::character varying, 'wallet'::character varying, 'cod'::character varying])::text[])))),
    CONSTRAINT chk_orders_total_amount_non_negative CHECK ((total_amount >= (0)::numeric))
);


ALTER TABLE public.orders OWNER TO postgres;

--
-- Name: TABLE orders; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.orders IS 'Orders table - registered users only (guest checkout removed March 2026)';


--
-- Name: COLUMN orders.razorpay_order_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.orders.razorpay_order_id IS 'Razorpay order ID (order_xxx)';


--
-- Name: COLUMN orders.razorpay_payment_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.orders.razorpay_payment_id IS 'Razorpay payment ID (pay_xxx)';


--
-- Name: COLUMN orders.cashfree_order_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.orders.cashfree_order_id IS 'Cashfree order ID';


--
-- Name: COLUMN orders.cashfree_reference_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.orders.cashfree_reference_id IS 'Cashfree reference ID';


--
-- Name: orders_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.orders_id_seq OWNER TO postgres;

--
-- Name: orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.orders_id_seq OWNED BY public.orders.id;


--
-- Name: otps; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.otps (
    id integer NOT NULL,
    otp_code character varying(10) NOT NULL,
    user_id integer,
    email character varying(255),
    phone character varying(20),
    otp_type character varying(20) NOT NULL,
    purpose character varying(50) NOT NULL,
    is_used boolean DEFAULT false,
    attempts integer DEFAULT 0,
    max_attempts integer DEFAULT 3,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    expires_at timestamp without time zone NOT NULL,
    used_at timestamp without time zone,
    ip_address character varying(45),
    user_agent text
);


ALTER TABLE public.otps OWNER TO postgres;

--
-- Name: otps_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.otps_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.otps_id_seq OWNER TO postgres;

--
-- Name: otps_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.otps_id_seq OWNED BY public.otps.id;


--
-- Name: payment_methods; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payment_methods (
    id integer NOT NULL,
    name character varying(50) NOT NULL,
    display_name character varying(100) NOT NULL,
    is_active boolean DEFAULT true,
    config jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.payment_methods OWNER TO postgres;

--
-- Name: payment_methods_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.payment_methods_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.payment_methods_id_seq OWNER TO postgres;

--
-- Name: payment_methods_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.payment_methods_id_seq OWNED BY public.payment_methods.id;


--
-- Name: payment_transactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payment_transactions (
    id integer NOT NULL,
    order_id integer,
    user_id integer NOT NULL,
    amount numeric(10,2) NOT NULL,
    currency character varying(10) DEFAULT 'INR'::character varying,
    payment_method character varying(50),
    cashfree_order_id character varying(255),
    cashfree_payment_id character varying(255),
    cf_payment_session_id character varying(500),
    razorpay_order_id character varying(255),
    razorpay_payment_id character varying(255),
    razorpay_signature character varying(500),
    transaction_id character varying(255),
    status character varying(50) DEFAULT 'pending'::character varying,
    gateway_response jsonb,
    description text,
    customer_email character varying(255),
    customer_phone character varying(20),
    refund_amount numeric(10,2),
    refund_id character varying(255),
    refund_status character varying(50),
    refund_reason text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    completed_at timestamp without time zone,
    cashfree_reference_id character varying(100),
    cashfree_session_id character varying(100),
    cashfree_signature character varying(500),
    razorpay_qr_code_id character varying(100),
    CONSTRAINT chk_payment_transactions_payment_method CHECK (((payment_method IS NULL) OR ((payment_method)::text = ANY (ARRAY[('cashfree'::character varying)::text, ('razorpay'::character varying)::text, ('easebuzz'::character varying)::text, ('upi'::character varying)::text, ('upi_qr'::character varying)::text, ('bank_transfer'::character varying)::text, ('wallet'::character varying)::text, ('cod'::character varying)::text]))))
);


ALTER TABLE public.payment_transactions OWNER TO postgres;

--
-- Name: COLUMN payment_transactions.cashfree_order_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.payment_transactions.cashfree_order_id IS 'Cashfree order ID from API';


--
-- Name: COLUMN payment_transactions.cashfree_reference_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.payment_transactions.cashfree_reference_id IS 'Cashfree reference ID for payment';


--
-- Name: COLUMN payment_transactions.cashfree_session_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.payment_transactions.cashfree_session_id IS 'Cashfree payment session ID';


--
-- Name: COLUMN payment_transactions.cashfree_signature; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.payment_transactions.cashfree_signature IS 'Cashfree payment signature';


--
-- Name: COLUMN payment_transactions.razorpay_qr_code_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.payment_transactions.razorpay_qr_code_id IS 'Razorpay QR code ID for UPI QR payments';


--
-- Name: payment_transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.payment_transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.payment_transactions_id_seq OWNER TO postgres;

--
-- Name: payment_transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.payment_transactions_id_seq OWNED BY public.payment_transactions.id;


--
-- Name: product_details_view; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.product_details_view AS
 SELECT p.id,
    p.name,
    p.slug,
    p.description,
    p.base_price,
    p.average_rating,
    p.review_count,
    p.total_stock,
    p.is_active,
    p.created_at,
    p.updated_at,
    c.name AS category_name,
    c.slug AS category_slug,
    COALESCE(sum(inv.quantity), (0)::bigint) AS available_quantity,
    min(inv.low_stock_threshold) AS low_stock_threshold
   FROM ((public.products p
     LEFT JOIN public.collections c ON ((p.category_id = c.id)))
     LEFT JOIN public.inventory inv ON ((p.id = inv.product_id)))
  GROUP BY p.id, p.name, p.slug, p.description, p.base_price, p.average_rating, p.review_count, p.total_stock, p.is_active, p.created_at, p.updated_at, c.name, c.slug;


ALTER TABLE public.product_details_view OWNER TO postgres;

--
-- Name: product_images; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.product_images (
    id integer NOT NULL,
    product_id integer NOT NULL,
    image_url character varying(500) NOT NULL,
    alt_text character varying(255),
    is_primary boolean DEFAULT false,
    display_order integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.product_images OWNER TO postgres;

--
-- Name: product_images_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.product_images_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.product_images_id_seq OWNER TO postgres;

--
-- Name: product_images_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.product_images_id_seq OWNED BY public.product_images.id;


--
-- Name: product_variants; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.product_variants AS
 SELECT inventory.id,
    inventory.product_id,
    inventory.size,
    inventory.color,
    inventory.sku,
    inventory.quantity AS inventory_count,
    inventory.created_at,
    inventory.updated_at
   FROM public.inventory;


ALTER TABLE public.product_variants OWNER TO postgres;

--
-- Name: products_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.products_id_seq OWNER TO postgres;

--
-- Name: products_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.products_id_seq OWNED BY public.products.id;


--
-- Name: promotion_usage; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.promotion_usage (
    id integer NOT NULL,
    promotion_id integer NOT NULL,
    user_id integer NOT NULL,
    order_id integer,
    discount_amount numeric(10,2) NOT NULL,
    used_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.promotion_usage OWNER TO postgres;

--
-- Name: promotion_usage_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.promotion_usage_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.promotion_usage_id_seq OWNER TO postgres;

--
-- Name: promotion_usage_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.promotion_usage_id_seq OWNED BY public.promotion_usage.id;


--
-- Name: promotions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.promotions (
    id integer NOT NULL,
    code character varying(50) NOT NULL,
    description text,
    discount_type public.discount_type NOT NULL,
    discount_value numeric(10,2) NOT NULL,
    min_order_value numeric(10,2) DEFAULT 0,
    max_discount_amount numeric(10,2),
    max_uses integer,
    used_count integer DEFAULT 0,
    max_uses_per_user integer DEFAULT 1,
    is_active boolean DEFAULT true,
    valid_from timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    valid_until timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.promotions OWNER TO postgres;

--
-- Name: promotions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.promotions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.promotions_id_seq OWNER TO postgres;

--
-- Name: promotions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.promotions_id_seq OWNED BY public.promotions.id;


--
-- Name: return_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.return_requests (
    id integer NOT NULL,
    order_id integer NOT NULL,
    user_id integer NOT NULL,
    reason public.return_reason NOT NULL,
    description text,
    status public.return_status DEFAULT 'requested'::public.return_status,
    refund_amount numeric(10,2),
    refund_transaction_id character varying(255),
    approved_by integer,
    rejection_reason text,
    return_tracking_number character varying(100),
    is_item_received boolean DEFAULT false,
    requested_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    approved_at timestamp without time zone,
    received_at timestamp without time zone,
    refunded_at timestamp without time zone,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    type public.return_type DEFAULT 'return'::public.return_type,
    items jsonb DEFAULT '[]'::jsonb,
    video_url text,
    exchange_preference character varying(255),
    video_upload_progress numeric(5,2)
);


ALTER TABLE public.return_requests OWNER TO postgres;

--
-- Name: COLUMN return_requests.type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.return_requests.type IS 'Type of request: return for refund or exchange for different item';


--
-- Name: COLUMN return_requests.items; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.return_requests.items IS 'JSON array of return items: [{item_id, quantity, reason, ...}, ...]';


--
-- Name: COLUMN return_requests.video_url; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.return_requests.video_url IS 'Cloudflare R2 URL for unboxing/defect video proof';


--
-- Name: COLUMN return_requests.exchange_preference; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.return_requests.exchange_preference IS 'Customer preference for exchange (e.g., "Exchange for size L", "Different color: blue")';


--
-- Name: return_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.return_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.return_requests_id_seq OWNER TO postgres;

--
-- Name: return_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.return_requests_id_seq OWNED BY public.return_requests.id;


--
-- Name: reviews; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.reviews (
    id integer NOT NULL,
    product_id integer NOT NULL,
    user_id integer NOT NULL,
    order_id integer,
    rating integer NOT NULL,
    title character varying(255),
    comment text,
    image_urls text[] DEFAULT '{}',
    is_verified_purchase boolean DEFAULT false,
    is_approved boolean DEFAULT false,
    helpful_count integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


ALTER TABLE public.reviews OWNER TO postgres;

--
-- Name: reviews_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.reviews_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.reviews_id_seq OWNER TO postgres;

--
-- Name: reviews_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.reviews_id_seq OWNED BY public.reviews.id;


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sessions (
    id integer NOT NULL,
    session_id character varying(255) NOT NULL,
    user_id integer NOT NULL,
    user_agent text,
    ip_address character varying(45),
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.sessions OWNER TO postgres;

--
-- Name: sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.sessions_id_seq OWNER TO postgres;

--
-- Name: sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.sessions_id_seq OWNED BY public.sessions.id;


--
-- Name: site_config; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.site_config (
    key character varying(100) NOT NULL,
    value text NOT NULL,
    description text,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    intro_video_url_desktop text,
    intro_video_url_mobile text
);


ALTER TABLE public.site_config OWNER TO postgres;

--
-- Name: staff_notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.staff_notifications (
    id integer NOT NULL,
    user_id integer,
    notification_type character varying(50) NOT NULL,
    message text NOT NULL,
    data jsonb,
    is_read boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.staff_notifications OWNER TO postgres;

--
-- Name: staff_notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.staff_notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.staff_notifications_id_seq OWNER TO postgres;

--
-- Name: staff_notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.staff_notifications_id_seq OWNED BY public.staff_notifications.id;


--
-- Name: staff_tasks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.staff_tasks (
    id integer NOT NULL,
    assigned_to integer,
    task_type character varying(50) NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    priority character varying(20) DEFAULT 'medium'::character varying,
    status character varying(20) DEFAULT 'pending'::character varying,
    due_time timestamp without time zone,
    completed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.staff_tasks OWNER TO postgres;

--
-- Name: staff_tasks_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.staff_tasks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.staff_tasks_id_seq OWNER TO postgres;

--
-- Name: staff_tasks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.staff_tasks_id_seq OWNED BY public.staff_tasks.id;


--
-- Name: stock_reservations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stock_reservations (
    id integer NOT NULL,
    reservation_id character varying(100) NOT NULL,
    user_id integer NOT NULL,
    sku character varying(50) NOT NULL,
    quantity integer NOT NULL,
    status character varying(20) NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    order_id integer,
    payment_ref character varying(255),
    created_at timestamp without time zone,
    updated_at timestamp without time zone
);


ALTER TABLE public.stock_reservations OWNER TO postgres;

--
-- Name: stock_reservations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.stock_reservations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.stock_reservations_id_seq OWNER TO postgres;

--
-- Name: stock_reservations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.stock_reservations_id_seq OWNED BY public.stock_reservations.id;


--
-- Name: user_profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_profiles (
    user_id integer NOT NULL,
    full_name character varying(100),
    phone character varying(20) NOT NULL,
    avatar_url character varying(500),
    bio text,
    date_of_birth date,
    gender character varying(20),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_user_profiles_phone_not_null CHECK (((phone IS NOT NULL) AND (length(TRIM(BOTH FROM phone)) >= 10)))
);


ALTER TABLE public.user_profiles OWNER TO postgres;

--
-- Name: user_security; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_security (
    user_id integer NOT NULL,
    failed_login_attempts integer DEFAULT 0,
    locked_until timestamp without time zone,
    last_login_at timestamp without time zone,
    last_login_ip character varying(45),
    password_history jsonb DEFAULT '[]'::jsonb,
    last_password_change timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.user_security OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    email character varying(255) NOT NULL,
    username character varying(50) NOT NULL,
    hashed_password character varying(255) NOT NULL,
    role public.user_role DEFAULT 'customer'::public.user_role,
    is_active boolean DEFAULT true,
    email_verified boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    must_change_password boolean DEFAULT false,
    is_superadmin boolean DEFAULT false,
    CONSTRAINT users_email_check CHECK (((email)::text ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'::text)),
    CONSTRAINT users_password_length CHECK ((length((hashed_password)::text) >= 60)),
    CONSTRAINT users_username_length CHECK ((length((username)::text) >= 3))
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.users_id_seq OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: webhook_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.webhook_events (
    id integer NOT NULL,
    gateway character varying(50) DEFAULT 'razorpay'::character varying NOT NULL,
    event_type character varying(100) NOT NULL,
    event_id character varying(255),
    payload jsonb NOT NULL,
    processed boolean DEFAULT false,
    processing_error text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    processed_at timestamp without time zone
);


ALTER TABLE public.webhook_events OWNER TO postgres;

--
-- Name: webhook_events_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.webhook_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.webhook_events_id_seq OWNER TO postgres;

--
-- Name: webhook_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.webhook_events_id_seq OWNED BY public.webhook_events.id;


--
-- Name: wishlist; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.wishlist (
    id integer NOT NULL,
    user_id integer NOT NULL,
    product_id integer NOT NULL,
    added_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.wishlist OWNER TO postgres;

--
-- Name: wishlist_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.wishlist_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.wishlist_id_seq OWNER TO postgres;

--
-- Name: wishlist_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.wishlist_id_seq OWNED BY public.wishlist.id;


--
-- Name: addresses id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.addresses ALTER COLUMN id SET DEFAULT nextval('public.addresses_id_seq'::regclass);


--
-- Name: ai_messages id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_messages ALTER COLUMN id SET DEFAULT nextval('public.ai_messages_id_seq'::regclass);


--
-- Name: ai_sessions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_sessions ALTER COLUMN id SET DEFAULT nextval('public.ai_sessions_id_seq'::regclass);


--
-- Name: ai_settings id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_settings ALTER COLUMN id SET DEFAULT nextval('public.ai_settings_id_seq'::regclass);


--
-- Name: analytics_cache id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.analytics_cache ALTER COLUMN id SET DEFAULT nextval('public.analytics_cache_id_seq'::regclass);


--
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);


--
-- Name: brands id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.brands ALTER COLUMN id SET DEFAULT nextval('public.brands_id_seq'::regclass);


--
-- Name: chat_messages id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_messages ALTER COLUMN id SET DEFAULT nextval('public.chat_messages_id_seq'::regclass);


--
-- Name: chat_rooms id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_rooms ALTER COLUMN id SET DEFAULT nextval('public.chat_rooms_id_seq'::regclass);


--
-- Name: collections id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.collections ALTER COLUMN id SET DEFAULT nextval('public.collections_id_seq'::regclass);


--
-- Name: easebuzz_refunds id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.easebuzz_refunds ALTER COLUMN id SET DEFAULT nextval('public.easebuzz_refunds_id_seq'::regclass);


--
-- Name: easebuzz_transactions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.easebuzz_transactions ALTER COLUMN id SET DEFAULT nextval('public.easebuzz_transactions_id_seq'::regclass);


--
-- Name: easebuzz_webhook_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.easebuzz_webhook_logs ALTER COLUMN id SET DEFAULT nextval('public.easebuzz_webhook_logs_id_seq'::regclass);


--
-- Name: email_verifications id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_verifications ALTER COLUMN id SET DEFAULT nextval('public.email_verifications_id_seq'::regclass);


--
-- Name: inventory id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory ALTER COLUMN id SET DEFAULT nextval('public.inventory_id_seq'::regclass);


--
-- Name: inventory_movements id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_movements ALTER COLUMN id SET DEFAULT nextval('public.inventory_movements_id_seq'::regclass);


--
-- Name: landing_config id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.landing_config ALTER COLUMN id SET DEFAULT nextval('public.landing_config_id_seq'::regclass);


--
-- Name: landing_images id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.landing_images ALTER COLUMN id SET DEFAULT nextval('public.landing_images_id_seq'::regclass);


--
-- Name: landing_products id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.landing_products ALTER COLUMN id SET DEFAULT nextval('public.landing_products_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- Name: order_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items ALTER COLUMN id SET DEFAULT nextval('public.order_items_id_seq'::regclass);


--
-- Name: order_tracking id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_tracking ALTER COLUMN id SET DEFAULT nextval('public.order_tracking_id_seq'::regclass);


--
-- Name: orders id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders ALTER COLUMN id SET DEFAULT nextval('public.orders_id_seq'::regclass);


--
-- Name: otps id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.otps ALTER COLUMN id SET DEFAULT nextval('public.otps_id_seq'::regclass);


--
-- Name: payment_methods id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_methods ALTER COLUMN id SET DEFAULT nextval('public.payment_methods_id_seq'::regclass);


--
-- Name: payment_transactions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_transactions ALTER COLUMN id SET DEFAULT nextval('public.payment_transactions_id_seq'::regclass);


--
-- Name: product_images id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_images ALTER COLUMN id SET DEFAULT nextval('public.product_images_id_seq'::regclass);


--
-- Name: products id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products ALTER COLUMN id SET DEFAULT nextval('public.products_id_seq'::regclass);


--
-- Name: promotion_usage id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.promotion_usage ALTER COLUMN id SET DEFAULT nextval('public.promotion_usage_id_seq'::regclass);


--
-- Name: promotions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.promotions ALTER COLUMN id SET DEFAULT nextval('public.promotions_id_seq'::regclass);


--
-- Name: return_requests id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.return_requests ALTER COLUMN id SET DEFAULT nextval('public.return_requests_id_seq'::regclass);


--
-- Name: reviews id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reviews ALTER COLUMN id SET DEFAULT nextval('public.reviews_id_seq'::regclass);


--
-- Name: sessions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sessions ALTER COLUMN id SET DEFAULT nextval('public.sessions_id_seq'::regclass);


--
-- Name: staff_notifications id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_notifications ALTER COLUMN id SET DEFAULT nextval('public.staff_notifications_id_seq'::regclass);


--
-- Name: staff_tasks id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_tasks ALTER COLUMN id SET DEFAULT nextval('public.staff_tasks_id_seq'::regclass);


--
-- Name: stock_reservations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_reservations ALTER COLUMN id SET DEFAULT nextval('public.stock_reservations_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: webhook_events id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.webhook_events ALTER COLUMN id SET DEFAULT nextval('public.webhook_events_id_seq'::regclass);


--
-- Name: wishlist id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wishlist ALTER COLUMN id SET DEFAULT nextval('public.wishlist_id_seq'::regclass);


--
-- Name: addresses addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.addresses
    ADD CONSTRAINT addresses_pkey PRIMARY KEY (id);


--
-- Name: ai_messages ai_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_messages
    ADD CONSTRAINT ai_messages_pkey PRIMARY KEY (id);


--
-- Name: ai_sessions ai_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_sessions
    ADD CONSTRAINT ai_sessions_pkey PRIMARY KEY (id);


--
-- Name: ai_sessions ai_sessions_session_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_sessions
    ADD CONSTRAINT ai_sessions_session_id_key UNIQUE (session_id);


--
-- Name: ai_settings ai_settings_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_settings
    ADD CONSTRAINT ai_settings_key_key UNIQUE (key);


--
-- Name: ai_settings ai_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_settings
    ADD CONSTRAINT ai_settings_pkey PRIMARY KEY (id);


--
-- Name: analytics_cache analytics_cache_cache_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.analytics_cache
    ADD CONSTRAINT analytics_cache_cache_key_key UNIQUE (cache_key);


--
-- Name: analytics_cache analytics_cache_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.analytics_cache
    ADD CONSTRAINT analytics_cache_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: brands brands_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.brands
    ADD CONSTRAINT brands_name_key UNIQUE (name);


--
-- Name: brands brands_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.brands
    ADD CONSTRAINT brands_pkey PRIMARY KEY (id);


--
-- Name: chat_messages chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (id);


--
-- Name: chat_rooms chat_rooms_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_rooms
    ADD CONSTRAINT chat_rooms_pkey PRIMARY KEY (id);


--
-- Name: chat_sessions chat_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_sessions
    ADD CONSTRAINT chat_sessions_pkey PRIMARY KEY (id);


--
-- Name: collections collections_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.collections
    ADD CONSTRAINT collections_pkey PRIMARY KEY (id);


--
-- Name: collections collections_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.collections
    ADD CONSTRAINT collections_slug_key UNIQUE (slug);


--
-- Name: easebuzz_refunds easebuzz_refunds_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.easebuzz_refunds
    ADD CONSTRAINT easebuzz_refunds_pkey PRIMARY KEY (id);


--
-- Name: easebuzz_transactions easebuzz_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.easebuzz_transactions
    ADD CONSTRAINT easebuzz_transactions_pkey PRIMARY KEY (id);


--
-- Name: easebuzz_webhook_logs easebuzz_webhook_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.easebuzz_webhook_logs
    ADD CONSTRAINT easebuzz_webhook_logs_pkey PRIMARY KEY (id);


--
-- Name: email_verifications email_verifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_verifications
    ADD CONSTRAINT email_verifications_pkey PRIMARY KEY (id);


--
-- Name: email_verifications email_verifications_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_verifications
    ADD CONSTRAINT email_verifications_token_key UNIQUE (token);


--
-- Name: inventory_movements inventory_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_pkey PRIMARY KEY (id);


--
-- Name: inventory inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_pkey PRIMARY KEY (id);


--
-- Name: landing_config landing_config_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.landing_config
    ADD CONSTRAINT landing_config_pkey PRIMARY KEY (id);


--
-- Name: landing_config landing_config_section_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.landing_config
    ADD CONSTRAINT landing_config_section_key UNIQUE (section);


--
-- Name: landing_images landing_images_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.landing_images
    ADD CONSTRAINT landing_images_pkey PRIMARY KEY (id);


--
-- Name: landing_products landing_products_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.landing_products
    ADD CONSTRAINT landing_products_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: order_tracking order_tracking_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_tracking
    ADD CONSTRAINT order_tracking_pkey PRIMARY KEY (id);


--
-- Name: orders orders_invoice_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_invoice_number_key UNIQUE (invoice_number);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: otps otps_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.otps
    ADD CONSTRAINT otps_pkey PRIMARY KEY (id);


--
-- Name: payment_methods payment_methods_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_methods
    ADD CONSTRAINT payment_methods_pkey PRIMARY KEY (id);


--
-- Name: payment_transactions payment_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_pkey PRIMARY KEY (id);


--
-- Name: payment_transactions payment_transactions_transaction_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_transaction_id_key UNIQUE (transaction_id);


--
-- Name: product_images product_images_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_images
    ADD CONSTRAINT product_images_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: products products_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_slug_key UNIQUE (slug);


--
-- Name: promotion_usage promotion_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.promotion_usage
    ADD CONSTRAINT promotion_usage_pkey PRIMARY KEY (id);


--
-- Name: promotions promotions_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.promotions
    ADD CONSTRAINT promotions_code_key UNIQUE (code);


--
-- Name: promotions promotions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.promotions
    ADD CONSTRAINT promotions_pkey PRIMARY KEY (id);


--
-- Name: return_requests return_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.return_requests
    ADD CONSTRAINT return_requests_pkey PRIMARY KEY (id);


--
-- Name: reviews reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_session_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_session_id_key UNIQUE (session_id);


--
-- Name: site_config site_config_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.site_config
    ADD CONSTRAINT site_config_pkey PRIMARY KEY (key);


--
-- Name: staff_notifications staff_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_notifications
    ADD CONSTRAINT staff_notifications_pkey PRIMARY KEY (id);


--
-- Name: staff_tasks staff_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_tasks
    ADD CONSTRAINT staff_tasks_pkey PRIMARY KEY (id);


--
-- Name: stock_reservations stock_reservations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_reservations
    ADD CONSTRAINT stock_reservations_pkey PRIMARY KEY (id);


--
-- Name: inventory uq_inventory_product_sku; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT uq_inventory_product_sku UNIQUE (product_id, sku);


--
-- Name: landing_products uq_landing_product_section; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.landing_products
    ADD CONSTRAINT uq_landing_product_section UNIQUE (section, product_id);


--
-- Name: wishlist uq_wishlist_user_product; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wishlist
    ADD CONSTRAINT uq_wishlist_user_product UNIQUE (user_id, product_id);


--
-- Name: user_profiles user_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_pkey PRIMARY KEY (user_id);


--
-- Name: user_security user_security_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_security
    ADD CONSTRAINT user_security_pkey PRIMARY KEY (user_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: webhook_events webhook_events_event_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.webhook_events
    ADD CONSTRAINT webhook_events_event_id_key UNIQUE (event_id);


--
-- Name: webhook_events webhook_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.webhook_events
    ADD CONSTRAINT webhook_events_pkey PRIMARY KEY (id);


--
-- Name: wishlist wishlist_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wishlist
    ADD CONSTRAINT wishlist_pkey PRIMARY KEY (id);


--
-- Name: idx_addresses_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_addresses_user ON public.addresses USING btree (user_id);


--
-- Name: idx_ai_messages_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ai_messages_created ON public.ai_messages USING btree (created_at DESC);


--
-- Name: idx_ai_messages_session; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ai_messages_session ON public.ai_messages USING btree (session_id);


--
-- Name: idx_ai_sessions_activity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ai_sessions_activity ON public.ai_sessions USING btree (last_activity DESC);


--
-- Name: idx_ai_sessions_role; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ai_sessions_role ON public.ai_sessions USING btree (role);


--
-- Name: idx_ai_sessions_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ai_sessions_user ON public.ai_sessions USING btree (user_id);


--
-- Name: idx_ai_settings_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ai_settings_category ON public.ai_settings USING btree (category);


--
-- Name: idx_ai_settings_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ai_settings_key ON public.ai_settings USING btree (key);


--
-- Name: idx_analytics_cache_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_analytics_cache_key ON public.analytics_cache USING btree (cache_key);


--
-- Name: idx_audit_logs_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_created ON public.audit_logs USING btree (created_at DESC);


--
-- Name: idx_audit_logs_resource; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_resource ON public.audit_logs USING btree (resource_type, resource_id);


--
-- Name: idx_audit_logs_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_user ON public.audit_logs USING btree (user_id);


--
-- Name: idx_cashfree_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cashfree_order ON public.payment_transactions USING btree (cashfree_order_id);


--
-- Name: idx_cashfree_reference; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cashfree_reference ON public.payment_transactions USING btree (cashfree_reference_id);


--
-- Name: idx_chat_messages_room; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chat_messages_room ON public.chat_messages USING btree (room_id);


--
-- Name: idx_chat_rooms_assigned; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chat_rooms_assigned ON public.chat_rooms USING btree (assigned_to);


--
-- Name: idx_chat_rooms_assigned_to; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chat_rooms_assigned_to ON public.chat_rooms USING btree (assigned_to);


--
-- Name: idx_chat_rooms_customer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chat_rooms_customer ON public.chat_rooms USING btree (customer_id);


--
-- Name: idx_chat_rooms_customer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chat_rooms_customer_id ON public.chat_rooms USING btree (customer_id);


--
-- Name: idx_chat_rooms_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_chat_rooms_status ON public.chat_rooms USING btree (status);


--
-- Name: idx_collections_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_collections_active ON public.collections USING btree (is_active);


--
-- Name: idx_collections_featured; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_collections_featured ON public.collections USING btree (is_featured) WHERE is_featured;


--
-- Name: idx_collections_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_collections_order ON public.collections USING btree (display_order);


--
-- Name: idx_collections_slug; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_collections_slug ON public.collections USING btree (slug);


--
-- Name: idx_email_verifications_expires; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_email_verifications_expires ON public.email_verifications USING btree (expires_at);


--
-- Name: idx_email_verifications_token; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_email_verifications_token ON public.email_verifications USING btree (token);


--
-- Name: idx_email_verifications_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_email_verifications_user ON public.email_verifications USING btree (user_id);


--
-- Name: idx_inventory_low_stock; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inventory_low_stock ON public.inventory USING btree (quantity) WHERE (quantity <= 10);


--
-- Name: idx_inventory_movements_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inventory_movements_created ON public.inventory_movements USING btree (created_at DESC);


--
-- Name: idx_inventory_movements_inventory; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inventory_movements_inventory ON public.inventory_movements USING btree (inventory_id);


--
-- Name: idx_inventory_movements_product; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inventory_movements_product ON public.inventory_movements USING btree (product_id);


--
-- Name: idx_inventory_product; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inventory_product ON public.inventory USING btree (product_id);


--
-- Name: idx_inventory_product_available; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inventory_product_available ON public.inventory USING btree (product_id, quantity, reserved_quantity) WHERE (quantity > 0);


--
-- Name: idx_inventory_quantity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inventory_quantity ON public.inventory USING btree (quantity);


--
-- Name: idx_inventory_sku; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inventory_sku ON public.inventory USING btree (sku);


--
-- Name: idx_inventory_sku_available; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inventory_sku_available ON public.inventory USING btree (sku, quantity) WHERE (quantity > 0);


--
-- Name: idx_landing_images_section; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_landing_images_section ON public.landing_images USING btree (section);


--
-- Name: idx_landing_products_section; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_landing_products_section ON public.landing_products USING btree (section, display_order, is_active);


--
-- Name: idx_notifications_unread; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notifications_unread ON public.notifications USING btree (user_id, is_read) WHERE (NOT is_read);


--
-- Name: idx_notifications_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notifications_user ON public.notifications USING btree (user_id);


--
-- Name: idx_order_items_inventory; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_order_items_inventory ON public.order_items USING btree (inventory_id);


--
-- Name: idx_order_items_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_order_items_order ON public.order_items USING btree (order_id);


--
-- Name: idx_order_items_order_product; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_order_items_order_product ON public.order_items USING btree (order_id, product_id);


--
-- Name: idx_order_items_order_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_order_items_order_status ON public.order_items USING btree (order_id);


--
-- Name: idx_order_items_product; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_order_items_product ON public.order_items USING btree (product_id);


--
-- Name: idx_order_tracking_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_order_tracking_order ON public.order_tracking USING btree (order_id);


--
-- Name: idx_order_tracking_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_order_tracking_status ON public.order_tracking USING btree (status);


--
-- Name: idx_orders_cashfree_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_cashfree_order ON public.orders USING btree (cashfree_order_id);


--
-- Name: idx_orders_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_created ON public.orders USING btree (created_at DESC);


--
-- Name: idx_orders_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_created_at ON public.orders USING btree (created_at DESC);


--
-- Name: idx_orders_invoice; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_invoice ON public.orders USING btree (invoice_number);


--
-- Name: idx_orders_payment_method; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_payment_method ON public.orders USING btree (payment_method);


--
-- Name: idx_orders_payment_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_payment_status ON public.orders USING btree (payment_method, status) WHERE (payment_method IS NOT NULL);


--
-- Name: idx_orders_razorpay_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_razorpay_order ON public.orders USING btree (razorpay_order_id);


--
-- Name: idx_orders_razorpay_payment; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_razorpay_payment ON public.orders USING btree (razorpay_payment_id);


--
-- Name: idx_orders_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_status ON public.orders USING btree (status);


--
-- Name: idx_orders_status_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_status_created ON public.orders USING btree (status, created_at DESC);


--
-- Name: idx_orders_transaction; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_transaction ON public.orders USING btree (transaction_id);


--
-- Name: idx_orders_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_user ON public.orders USING btree (user_id);


--
-- Name: idx_orders_user_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_user_status ON public.orders USING btree (user_id, status);


--
-- Name: idx_orders_user_status_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_user_status_created ON public.orders USING btree (user_id, status, created_at DESC);


--
-- Name: idx_otps_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_otps_code ON public.otps USING btree (otp_code);


--
-- Name: idx_otps_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_otps_email ON public.otps USING btree (email);


--
-- Name: idx_otps_expires; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_otps_expires ON public.otps USING btree (expires_at);


--
-- Name: idx_otps_phone; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_otps_phone ON public.otps USING btree (phone);


--
-- Name: idx_otps_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_otps_type ON public.otps USING btree (otp_type);


--
-- Name: idx_otps_used; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_otps_used ON public.otps USING btree (is_used) WHERE (NOT is_used);


--
-- Name: idx_otps_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_otps_user ON public.otps USING btree (user_id);


--
-- Name: idx_payment_cashfree; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payment_cashfree ON public.payment_transactions USING btree (cashfree_order_id);


--
-- Name: idx_payment_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payment_order ON public.payment_transactions USING btree (order_id);


--
-- Name: idx_payment_razorpay; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payment_razorpay ON public.payment_transactions USING btree (razorpay_payment_id);


--
-- Name: idx_payment_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payment_status ON public.payment_transactions USING btree (status);


--
-- Name: idx_payment_transactions_order_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payment_transactions_order_user ON public.payment_transactions USING btree (order_id, user_id);


--
-- Name: idx_payment_transactions_payment_method; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payment_transactions_payment_method ON public.payment_transactions USING btree (payment_method);


--
-- Name: idx_payment_transactions_razorpay_qr_code_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payment_transactions_razorpay_qr_code_id ON public.payment_transactions USING btree (razorpay_qr_code_id);


--
-- Name: idx_payment_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payment_user ON public.payment_transactions USING btree (user_id);


--
-- Name: idx_product_images_product; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_product_images_product ON public.product_images USING btree (product_id);


--
-- Name: idx_product_images_product_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_product_images_product_order ON public.product_images USING btree (product_id, display_order, is_primary);


--
-- Name: idx_products_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_active ON public.products USING btree (is_active);


--
-- Name: idx_products_active_category_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_active_category_created ON public.products USING btree (is_active, category_id, created_at DESC);


--
-- Name: idx_products_active_new; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_active_new ON public.products USING btree (id, created_at DESC) WHERE ((is_active = true) AND (is_new_arrival = true));


--
-- Name: idx_products_active_new_arrivals; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_active_new_arrivals ON public.products USING btree (updated_at DESC) WHERE ((is_active = true) AND (is_new_arrival = true));


--
-- Name: idx_products_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_category ON public.products USING btree (category_id);


--
-- Name: idx_products_category_active_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_category_active_created ON public.products USING btree (category_id, is_active, created_at DESC) WHERE (is_active = true);


--
-- Name: idx_products_category_featured; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_category_featured ON public.products USING btree (category_id, is_featured) WHERE ((is_active = true) AND (is_featured = true));


--
-- Name: idx_products_description_gin; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_description_gin ON public.products USING gin (to_tsvector('english'::regconfig, COALESCE(description, ''::text)));


--
-- Name: idx_products_embedding; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_embedding ON public.products USING hnsw (embedding public.vector_cosine_ops);


--
-- Name: idx_products_featured; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_featured ON public.products USING btree (is_featured) WHERE is_featured;


--
-- Name: idx_products_featured_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_featured_category ON public.products USING btree (is_featured, category_id) WHERE (is_featured = true);


--
-- Name: idx_products_listings; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_listings ON public.products USING btree (is_active, category_id, created_at DESC);


--
-- Name: idx_products_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_name ON public.products USING btree (name);


--
-- Name: idx_products_name_gin; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_name_gin ON public.products USING gin (to_tsvector('english'::regconfig, (name)::text));


--
-- Name: idx_products_new_arrival; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_new_arrival ON public.products USING btree (is_new_arrival) WHERE is_new_arrival;


--
-- Name: idx_products_new_arrival_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_new_arrival_created ON public.products USING btree (is_new_arrival, created_at DESC) WHERE (is_new_arrival = true);


--
-- Name: idx_products_price; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_price ON public.products USING btree (base_price);


--
-- Name: idx_products_search_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_search_active ON public.products USING btree (name, category_id, is_active) WHERE (is_active = true);


--
-- Name: idx_products_slug; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_slug ON public.products USING btree (slug);


--
-- Name: idx_promotion_usage_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_promotion_usage_order ON public.promotion_usage USING btree (order_id);


--
-- Name: idx_promotion_usage_promotion; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_promotion_usage_promotion ON public.promotion_usage USING btree (promotion_id);


--
-- Name: idx_promotion_usage_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_promotion_usage_user ON public.promotion_usage USING btree (user_id);


--
-- Name: idx_promotions_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_promotions_active ON public.promotions USING btree (is_active) WHERE is_active;


--
-- Name: idx_promotions_active_dates; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_promotions_active_dates ON public.promotions USING btree (is_active, valid_from, valid_until) WHERE (is_active = true);


--
-- Name: idx_promotions_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_promotions_code ON public.promotions USING btree (code);


--
-- Name: idx_promotions_valid_from; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_promotions_valid_from ON public.promotions USING btree (valid_from);


--
-- Name: idx_promotions_valid_until; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_promotions_valid_until ON public.promotions USING btree (valid_until);


--
-- Name: idx_return_requests_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_return_requests_order ON public.return_requests USING btree (order_id);


--
-- Name: idx_return_requests_requested_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_return_requests_requested_at ON public.return_requests USING btree (requested_at);


--
-- Name: idx_return_requests_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_return_requests_status ON public.return_requests USING btree (status);


--
-- Name: idx_return_requests_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_return_requests_type ON public.return_requests USING btree (type);


--
-- Name: idx_return_requests_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_return_requests_user ON public.return_requests USING btree (user_id);


--
-- Name: idx_return_requests_video; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_return_requests_video ON public.return_requests USING btree (video_url) WHERE (video_url IS NOT NULL);


--
-- Name: idx_reviews_approved; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reviews_approved ON public.reviews USING btree (is_approved) WHERE is_approved;


--
-- Name: idx_reviews_product; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reviews_product ON public.reviews USING btree (product_id);


--
-- Name: idx_reviews_product_approved_rating; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reviews_product_approved_rating ON public.reviews USING btree (product_id, is_approved, rating DESC, created_at DESC);


--
-- Name: idx_reviews_rating; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reviews_rating ON public.reviews USING btree (rating);


--
-- Name: idx_reviews_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reviews_user ON public.reviews USING btree (user_id);


--
-- Name: idx_sessions_expires; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sessions_expires ON public.sessions USING btree (expires_at);


--
-- Name: idx_sessions_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sessions_user ON public.sessions USING btree (user_id);


--
-- Name: idx_staff_notifications_unread; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_staff_notifications_unread ON public.staff_notifications USING btree (is_read) WHERE (NOT is_read);


--
-- Name: idx_staff_notifications_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_staff_notifications_user ON public.staff_notifications USING btree (user_id);


--
-- Name: idx_staff_tasks_assigned; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_staff_tasks_assigned ON public.staff_tasks USING btree (assigned_to);


--
-- Name: idx_staff_tasks_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_staff_tasks_status ON public.staff_tasks USING btree (status);


--
-- Name: idx_users_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_created_at ON public.users USING btree (created_at DESC);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_email_verified; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_email_verified ON public.users USING btree (email_verified);


--
-- Name: idx_users_is_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_is_active ON public.users USING btree (is_active);


--
-- Name: idx_users_role; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_role ON public.users USING btree (role);


--
-- Name: idx_users_role_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_role_active ON public.users USING btree (role, is_active);


--
-- Name: idx_users_username; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_username ON public.users USING btree (username);


--
-- Name: idx_webhook_event_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_webhook_event_id ON public.webhook_events USING btree (event_id);


--
-- Name: idx_webhook_processed; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_webhook_processed ON public.webhook_events USING btree (processed);


--
-- Name: idx_wishlist_product; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wishlist_product ON public.wishlist USING btree (product_id);


--
-- Name: idx_wishlist_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_wishlist_user ON public.wishlist USING btree (user_id);


--
-- Name: ix_chat_sessions_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_chat_sessions_id ON public.chat_sessions USING btree (id);


--
-- Name: ix_chat_sessions_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_chat_sessions_user_id ON public.chat_sessions USING btree (user_id);


--
-- Name: ix_easebuzz_refunds_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_easebuzz_refunds_id ON public.easebuzz_refunds USING btree (id);


--
-- Name: ix_easebuzz_refunds_original_transaction_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_easebuzz_refunds_original_transaction_id ON public.easebuzz_refunds USING btree (original_transaction_id);


--
-- Name: ix_easebuzz_refunds_refund_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ix_easebuzz_refunds_refund_id ON public.easebuzz_refunds USING btree (refund_id);


--
-- Name: ix_easebuzz_transactions_easebuzz_order_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_easebuzz_transactions_easebuzz_order_id ON public.easebuzz_transactions USING btree (easebuzz_order_id);


--
-- Name: ix_easebuzz_transactions_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_easebuzz_transactions_id ON public.easebuzz_transactions USING btree (id);


--
-- Name: ix_easebuzz_transactions_order_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_easebuzz_transactions_order_id ON public.easebuzz_transactions USING btree (order_id);


--
-- Name: ix_easebuzz_transactions_transaction_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ix_easebuzz_transactions_transaction_id ON public.easebuzz_transactions USING btree (transaction_id);


--
-- Name: ix_easebuzz_transactions_txnid; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_easebuzz_transactions_txnid ON public.easebuzz_transactions USING btree (txnid);


--
-- Name: ix_easebuzz_transactions_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_easebuzz_transactions_user_id ON public.easebuzz_transactions USING btree (user_id);


--
-- Name: ix_easebuzz_webhook_logs_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_easebuzz_webhook_logs_id ON public.easebuzz_webhook_logs USING btree (id);


--
-- Name: ix_easebuzz_webhook_logs_transaction_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_easebuzz_webhook_logs_transaction_id ON public.easebuzz_webhook_logs USING btree (transaction_id);


--
-- Name: ix_easebuzz_webhook_logs_webhook_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ix_easebuzz_webhook_logs_webhook_id ON public.easebuzz_webhook_logs USING btree (webhook_id);


--
-- Name: ix_stock_reservations_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_stock_reservations_created_at ON public.stock_reservations USING btree (created_at);


--
-- Name: ix_stock_reservations_expires_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_stock_reservations_expires_at ON public.stock_reservations USING btree (expires_at);


--
-- Name: ix_stock_reservations_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_stock_reservations_id ON public.stock_reservations USING btree (id);


--
-- Name: ix_stock_reservations_order_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_stock_reservations_order_id ON public.stock_reservations USING btree (order_id);


--
-- Name: ix_stock_reservations_reservation_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ix_stock_reservations_reservation_id ON public.stock_reservations USING btree (reservation_id);


--
-- Name: ix_stock_reservations_sku; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_stock_reservations_sku ON public.stock_reservations USING btree (sku);


--
-- Name: ix_stock_reservations_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_stock_reservations_user_id ON public.stock_reservations USING btree (user_id);


--
-- Name: uq_inventory_sku; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uq_inventory_sku ON public.inventory USING btree (sku);


--
-- Name: order_details_view _RETURN; Type: RULE; Schema: public; Owner: postgres
--

CREATE OR REPLACE VIEW public.order_details_view AS
 SELECT o.id,
    o.user_id,
    u.email AS customer_email,
    u.username AS customer_username,
    up.full_name AS customer_name,
    o.total_amount,
    o.status,
    o.created_at,
    o.shipped_at,
    o.delivered_at,
    o.cancelled_at,
    count(oi.id) AS item_count
   FROM (((public.orders o
     JOIN public.users u ON ((o.user_id = u.id)))
     LEFT JOIN public.user_profiles up ON ((u.id = up.user_id)))
     LEFT JOIN public.order_items oi ON ((o.id = oi.order_id)))
  GROUP BY o.id, u.email, u.username, up.full_name;


--
-- Name: collections trigger_collections_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_collections_updated_at BEFORE UPDATE ON public.collections FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: inventory trigger_inventory_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_inventory_updated_at BEFORE UPDATE ON public.inventory FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: landing_products trigger_landing_products_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_landing_products_updated_at BEFORE UPDATE ON public.landing_products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: orders trigger_orders_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: product_images trigger_product_images_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_product_images_updated_at BEFORE UPDATE ON public.product_images FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: products trigger_products_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: reviews trigger_update_product_rating; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_product_rating AFTER INSERT OR DELETE OR UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.update_product_rating();


--
-- Name: inventory trigger_update_product_total_stock; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_product_total_stock AFTER INSERT OR DELETE OR UPDATE ON public.inventory FOR EACH ROW EXECUTE FUNCTION public.update_product_total_stock();


--
-- Name: users trigger_users_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: collections update_categories_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON public.collections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: inventory update_inventory_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON public.inventory FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: orders update_orders_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: products update_products_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: user_profiles update_user_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: user_security update_user_security_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_user_security_updated_at BEFORE UPDATE ON public.user_security FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: addresses addresses_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.addresses
    ADD CONSTRAINT addresses_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: ai_messages ai_messages_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_messages
    ADD CONSTRAINT ai_messages_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.ai_sessions(session_id) ON DELETE CASCADE;


--
-- Name: ai_sessions ai_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_sessions
    ADD CONSTRAINT ai_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: ai_settings ai_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_settings
    ADD CONSTRAINT ai_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: chat_messages chat_messages_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.chat_rooms(id) ON DELETE CASCADE;


--
-- Name: email_verifications email_verifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_verifications
    ADD CONSTRAINT email_verifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: addresses fk_addresses_user_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.addresses
    ADD CONSTRAINT fk_addresses_user_id FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: chat_messages fk_chat_messages_sender_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT fk_chat_messages_sender_id FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: chat_rooms fk_chat_rooms_assigned_to; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_rooms
    ADD CONSTRAINT fk_chat_rooms_assigned_to FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: chat_rooms fk_chat_rooms_customer_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_rooms
    ADD CONSTRAINT fk_chat_rooms_customer_id FOREIGN KEY (customer_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: inventory_movements fk_inventory_movements_performed_by; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT fk_inventory_movements_performed_by FOREIGN KEY (performed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: landing_config fk_landing_config_updated_by; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.landing_config
    ADD CONSTRAINT fk_landing_config_updated_by FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: order_items fk_order_items_inventory_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT fk_order_items_inventory_id FOREIGN KEY (inventory_id) REFERENCES public.inventory(id) ON DELETE SET NULL;


--
-- Name: payment_transactions fk_payment_transactions_order_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT fk_payment_transactions_order_id FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE RESTRICT;


--
-- Name: payment_transactions fk_payment_transactions_user_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT fk_payment_transactions_user_id FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: promotion_usage fk_promotion_usage_user_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.promotion_usage
    ADD CONSTRAINT fk_promotion_usage_user_id FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: return_requests fk_return_requests_user_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.return_requests
    ADD CONSTRAINT fk_return_requests_user_id FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: reviews fk_reviews_user_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT fk_reviews_user_id FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: staff_notifications fk_staff_notifications_user_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_notifications
    ADD CONSTRAINT fk_staff_notifications_user_id FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: staff_tasks fk_staff_tasks_assigned_to; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_tasks
    ADD CONSTRAINT fk_staff_tasks_assigned_to FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: wishlist fk_wishlist_user_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wishlist
    ADD CONSTRAINT fk_wishlist_user_id FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: inventory_movements inventory_movements_inventory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_inventory_id_fkey FOREIGN KEY (inventory_id) REFERENCES public.inventory(id) ON DELETE CASCADE;


--
-- Name: inventory_movements inventory_movements_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: inventory inventory_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: landing_products landing_products_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.landing_products
    ADD CONSTRAINT landing_products_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: order_items order_items_inventory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_inventory_id_fkey FOREIGN KEY (inventory_id) REFERENCES public.inventory(id);


--
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: order_tracking order_tracking_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_tracking
    ADD CONSTRAINT order_tracking_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: orders orders_billing_address_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_billing_address_id_fkey FOREIGN KEY (billing_address_id) REFERENCES public.addresses(id) ON DELETE SET NULL;


--
-- Name: orders orders_shipping_address_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_shipping_address_id_fkey FOREIGN KEY (shipping_address_id) REFERENCES public.addresses(id) ON DELETE SET NULL;


--
-- Name: orders orders_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: otps otps_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.otps
    ADD CONSTRAINT otps_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: product_images product_images_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_images
    ADD CONSTRAINT product_images_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: products products_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.collections(id) ON DELETE SET NULL;


--
-- Name: promotion_usage promotion_usage_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.promotion_usage
    ADD CONSTRAINT promotion_usage_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: promotion_usage promotion_usage_promotion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.promotion_usage
    ADD CONSTRAINT promotion_usage_promotion_id_fkey FOREIGN KEY (promotion_id) REFERENCES public.promotions(id) ON DELETE CASCADE;


--
-- Name: return_requests return_requests_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.return_requests
    ADD CONSTRAINT return_requests_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: reviews reviews_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;


--
-- Name: reviews reviews_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: reviews reviews_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: user_profiles user_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_security user_security_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_security
    ADD CONSTRAINT user_security_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: wishlist wishlist_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wishlist
    ADD CONSTRAINT wishlist_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: wishlist wishlist_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wishlist
    ADD CONSTRAINT wishlist_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict tGO7KgAReH59OUTiJW2hctbwU9zvfjHeJGpaJFqmyOezVt2NAf2pO4YT6VS8RW6

