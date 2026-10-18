-- Generado por scripts/generar-baseline.js a partir de los modelos Sequelize.
-- NO editar a mano: los cambios de esquema van en migraciones nuevas.
--
-- PostgreSQL database dump
--


-- Dumped from database version 17.11 (Debian 17.11-1.pgdg13+2)
-- Dumped by pg_dump version 17.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: enum_AperturaCajas_estado; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."enum_AperturaCajas_estado" AS ENUM (
    'abierta',
    'cerrada'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: AperturaCajas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AperturaCajas" (
    id integer NOT NULL,
    fecha_apertura date NOT NULL,
    hora_apertura character varying(8),
    monto_apertura numeric(11,2) NOT NULL,
    estado public."enum_AperturaCajas_estado" DEFAULT 'abierta'::public."enum_AperturaCajas_estado" NOT NULL,
    total_ventas numeric(11,2),
    monto_cierre_fisico numeric(11,2),
    diferencia numeric(11,2),
    observacion character varying(250),
    total_efectivo numeric(11,2),
    total_yape numeric(11,2),
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


--
-- Name: AperturaCajas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."AperturaCajas_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: AperturaCajas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."AperturaCajas_id_seq" OWNED BY public."AperturaCajas".id;


--
-- Name: Cliente; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Cliente" (
    id integer NOT NULL,
    tipo_documento_id character(1),
    nrodoc character varying(15),
    razon_social character varying(100),
    direccion character varying(100)
);


--
-- Name: Cliente_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Cliente_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Cliente_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Cliente_id_seq" OWNED BY public."Cliente".id;


--
-- Name: Comprobante; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Comprobante" (
    id integer NOT NULL,
    emisor_id integer,
    tipo_comprobante_id character(2),
    serie_id integer,
    serie character varying(4),
    correlativo integer,
    forma_pago character varying(50),
    fecha_emision timestamp with time zone,
    fecha_vencimiento timestamp with time zone,
    moneda_id character(3),
    op_gravadas numeric(11,2),
    op_exoneradas numeric(11,2),
    op_inafectas numeric(11,2),
    igv numeric(11,2),
    total numeric(11,2),
    cliente_id integer,
    estado_sunat character varying(15) DEFAULT 'GENERADO'::character varying,
    cdr_code character varying(10),
    cdr_xml text,
    xml_path text,
    hash character varying(255),
    enviado_at timestamp with time zone,
    codigo_sunat character varying(10),
    mensaje_sunat character varying(500),
    hash_cpe character varying(255),
    nombre_xml character varying(60),
    fecha_envio_sunat timestamp with time zone,
    intentos_envio integer DEFAULT 0,
    es_terminal boolean DEFAULT false,
    tipo_nota_id character varying(4),
    descripcion_nota character varying(250),
    comprobante_ref_id integer,
    op_gratuitas numeric(11,2),
    icbper numeric(11,2),
    metodo_pago character varying(50)
);


--
-- Name: Comprobante_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Comprobante_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Comprobante_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Comprobante_id_seq" OWNED BY public."Comprobante".id;


--
-- Name: ComunicacionBaja; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ComunicacionBaja" (
    id integer NOT NULL,
    emisor_id integer,
    correlativo integer,
    fecha_emision date,
    fecha_referencia date,
    nombre_xml character varying(60),
    ticket character varying(50),
    estado_ticket character(2) DEFAULT 'PE'::bpchar,
    codigo_sunat character varying(10),
    mensaje_sunat character varying(500),
    fecha_envio timestamp with time zone
);


--
-- Name: ComunicacionBajaDetalle; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ComunicacionBajaDetalle" (
    id integer NOT NULL,
    baja_id integer,
    comprobante_id integer,
    tipo_comprobante_id character(2),
    serie character varying(4),
    correlativo integer,
    motivo_baja character varying(100)
);


--
-- Name: ComunicacionBajaDetalle_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."ComunicacionBajaDetalle_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ComunicacionBajaDetalle_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."ComunicacionBajaDetalle_id_seq" OWNED BY public."ComunicacionBajaDetalle".id;


--
-- Name: ComunicacionBaja_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."ComunicacionBaja_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ComunicacionBaja_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."ComunicacionBaja_id_seq" OWNED BY public."ComunicacionBaja".id;


--
-- Name: Cuota; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Cuota" (
    id integer NOT NULL,
    comprobante_id integer,
    numero character varying(3),
    importe numeric(15,6),
    fecha_vencimiento timestamp with time zone,
    estado character(1)
);


--
-- Name: Cuota_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Cuota_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Cuota_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Cuota_id_seq" OWNED BY public."Cuota".id;


--
-- Name: Detalle; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Detalle" (
    id integer NOT NULL,
    comprobante_id integer,
    item integer,
    descripcion character varying(500),
    unidad_id character varying(10),
    producto_id integer,
    cantidad numeric(15,6),
    valor_unitario numeric(15,6),
    precio_unitario numeric(15,6),
    igv numeric(15,6),
    porcentaje_igv numeric(15,6),
    valor_total numeric(15,6),
    importe_total numeric(15,6)
);


--
-- Name: DetalleAlmanaques; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."DetalleAlmanaques" (
    id integer NOT NULL,
    cantidad integer NOT NULL,
    descripcion character varying(255) NOT NULL,
    unidad character(50) NOT NULL,
    "precioUnitario" double precision NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "AlmanaqueId" integer
);


--
-- Name: DetalleAlmanaques_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."DetalleAlmanaques_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: DetalleAlmanaques_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."DetalleAlmanaques_id_seq" OWNED BY public."DetalleAlmanaques".id;


--
-- Name: DetalleGuia; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."DetalleGuia" (
    id integer NOT NULL,
    guia_id integer,
    item integer,
    descripcion character varying(500),
    cantidad numeric(15,6),
    unidad_id character(3),
    numero_serie character varying(50),
    codigo_sunat character varying(12)
);


--
-- Name: DetalleGuia_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."DetalleGuia_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: DetalleGuia_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."DetalleGuia_id_seq" OWNED BY public."DetalleGuia".id;


--
-- Name: DetalleTickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."DetalleTickets" (
    id integer NOT NULL,
    cantidad integer NOT NULL,
    descripcion character varying(255) NOT NULL,
    "precioUnitario" double precision NOT NULL,
    subtotal double precision NOT NULL,
    producto_id integer,
    es_servicio boolean DEFAULT false,
    adelanto numeric DEFAULT 0,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    "ticketId" integer
);


--
-- Name: DetalleTickets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."DetalleTickets_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: DetalleTickets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."DetalleTickets_id_seq" OWNED BY public."DetalleTickets".id;


--
-- Name: Detalle_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Detalle_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Detalle_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Detalle_id_seq" OWNED BY public."Detalle".id;


--
-- Name: Emisor; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Emisor" (
    id integer NOT NULL,
    tipodoc character(1),
    ruc character(11),
    razon_social character varying(100),
    nombre_comercial character varying(100),
    direccion character varying(100),
    pais character varying(100),
    departamento character varying(100),
    provincia character varying(100),
    distrito character varying(100),
    ubigeo character(6),
    usuario_sol character varying(20),
    clave_sol character varying(20),
    telefono character varying(20),
    logo_url character varying(255),
    descripcion character varying(200),
    client_id character varying(200),
    client_secret character varying(200)
);


--
-- Name: Emisor_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Emisor_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Emisor_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Emisor_id_seq" OWNED BY public."Emisor".id;


--
-- Name: EnvioResumen; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."EnvioResumen" (
    id integer NOT NULL,
    fecha_envio timestamp with time zone,
    fecha_referencia timestamp with time zone,
    correlativo integer,
    resumen smallint,
    baja smallint,
    nombrexml character varying(50),
    mensaje_sunat character varying(200),
    codigo_sunat character varying(20),
    ticket character varying(50),
    estado character(1),
    emisor_id integer,
    tipo character(2),
    estado_ticket character(2) DEFAULT 'PE'::bpchar,
    xml_firmado text
);


--
-- Name: EnvioResumenDetalle; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."EnvioResumenDetalle" (
    iddetalle integer NOT NULL,
    envio_id integer,
    comprobante_id integer,
    condicion smallint
);


--
-- Name: EnvioResumenDetalle_iddetalle_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."EnvioResumenDetalle_iddetalle_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: EnvioResumenDetalle_iddetalle_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."EnvioResumenDetalle_iddetalle_seq" OWNED BY public."EnvioResumenDetalle".iddetalle;


--
-- Name: EnvioResumen_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."EnvioResumen_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: EnvioResumen_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."EnvioResumen_id_seq" OWNED BY public."EnvioResumen".id;


--
-- Name: GuiaRemision; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."GuiaRemision" (
    id integer NOT NULL,
    emisor_id integer,
    tipo_guia character(2),
    serie character varying(4),
    correlativo integer,
    fecha_emision date,
    fecha_traslado date,
    motivo_traslado_id character varying(2),
    descripcion_motivo character varying(250),
    indicador_transborde boolean DEFAULT false,
    peso_bruto_total numeric(12,3),
    unidad_peso_id character(3),
    numero_bultos integer,
    numero_contenedor character varying(20),
    codigo_puerto character varying(10),
    modalidad_traslado character(2),
    transportista_ruc character(11),
    transportista_razon_social character varying(100),
    mtc_numero character varying(20),
    conductor_nrodoc character varying(15),
    conductor_tipo_doc character(1),
    conductor_nombres character varying(100),
    conductor_licencia character varying(20),
    vehiculo_placa character varying(10),
    destinatario_id integer,
    ubigeo_partida character(6),
    direccion_partida character varying(200),
    ubigeo_llegada character(6),
    direccion_llegada character varying(200),
    comprobante_rel_id integer,
    estado_sunat character(2) DEFAULT 'PE'::bpchar,
    codigo_sunat character varying(10),
    mensaje_sunat character varying(500),
    hash_cpe character varying(255),
    nombre_xml character varying(60),
    fecha_envio_sunat timestamp with time zone,
    intentos_envio integer DEFAULT 0
);


--
-- Name: GuiaRemision_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."GuiaRemision_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: GuiaRemision_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."GuiaRemision_id_seq" OWNED BY public."GuiaRemision".id;


--
-- Name: Moneda; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Moneda" (
    id character(3) NOT NULL,
    descripcion character varying(50)
);


--
-- Name: Producto; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Producto" (
    id integer NOT NULL,
    nombre character varying(255),
    valor_unitario numeric(15,6),
    tipo_afectacion_id character(2),
    unidad_id character(3),
    codigo_sunat character varying(12),
    codigo_barras character varying(100),
    afecto_icbper smallint,
    factor_icbper numeric(15,2),
    stock integer DEFAULT 0,
    es_servicio boolean DEFAULT false
);


--
-- Name: Producto_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Producto_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Producto_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Producto_id_seq" OWNED BY public."Producto".id;


--
-- Name: Serie; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Serie" (
    id integer NOT NULL,
    tipo_comprobante_id character(2),
    serie character varying(4),
    correlativo integer
);


--
-- Name: Serie_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Serie_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Serie_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Serie_id_seq" OWNED BY public."Serie".id;


--
-- Name: TablaParametrica; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TablaParametrica" (
    tipo character(1) NOT NULL,
    codigo character varying(5) NOT NULL,
    descripcion character varying(200)
);


--
-- Name: Tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Tickets" (
    id integer NOT NULL,
    cliente character varying(255) NOT NULL,
    "tipoDocumento" character varying(255) NOT NULL,
    "numeroDocumento" character varying(255) NOT NULL,
    direccion character varying(255),
    "fechaEmision" timestamp with time zone NOT NULL,
    "precioTotal" double precision NOT NULL,
    metodo_pago character varying(50),
    monto_recibido double precision,
    vuelto double precision,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


--
-- Name: Tickets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Tickets_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Tickets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Tickets_id_seq" OWNED BY public."Tickets".id;


--
-- Name: TipoAfectacion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TipoAfectacion" (
    id character(2) NOT NULL,
    descripcion character varying(50),
    letra character(1),
    codigo character(4),
    nombre character(3),
    tipo character(3)
);


--
-- Name: TipoComprobante; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TipoComprobante" (
    id character(2) NOT NULL,
    descripcion character varying(100)
);


--
-- Name: TipoDocumento; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TipoDocumento" (
    id character(1) NOT NULL,
    descripcion character varying(50)
);


--
-- Name: Unidad; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Unidad" (
    id character(3) NOT NULL,
    descripcion character varying(50)
);


--
-- Name: almanaque; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.almanaque (
    id integer NOT NULL,
    cliente character varying(255) NOT NULL,
    "tipoDocumento" character varying(255),
    "numeroDocumento" character varying(255) NOT NULL,
    direccion character varying(255),
    telefono character varying(255),
    "fechaEmision" timestamp with time zone NOT NULL,
    "aCuenta" double precision NOT NULL,
    "precioTotal" double precision NOT NULL,
    tipo character varying(255) DEFAULT 'cotizacion'::character varying NOT NULL,
    impreso boolean DEFAULT false NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


--
-- Name: almanaque_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.almanaque_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: almanaque_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.almanaque_id_seq OWNED BY public.almanaque.id;


--
-- Name: egresos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.egresos (
    id integer NOT NULL,
    monto numeric(10,2) NOT NULL,
    descripcion character varying(255),
    fecha timestamp with time zone NOT NULL,
    metodo character varying(255) NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


--
-- Name: egresos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.egresos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: egresos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.egresos_id_seq OWNED BY public.egresos.id;


--
-- Name: formatos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.formatos (
    id integer NOT NULL,
    key character varying(255) NOT NULL,
    nombre character varying(255) NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


--
-- Name: formatos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.formatos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: formatos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.formatos_id_seq OWNED BY public.formatos.id;


--
-- Name: ingresos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ingresos (
    id integer NOT NULL,
    monto numeric(10,2) NOT NULL,
    descripcion character varying(255),
    fecha timestamp with time zone NOT NULL,
    metodo character varying(255) NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


--
-- Name: ingresos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ingresos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ingresos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ingresos_id_seq OWNED BY public.ingresos.id;


--
-- Name: logins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.logins (
    id integer NOT NULL,
    usuario character varying(255) NOT NULL,
    password character varying(255) NOT NULL,
    cargo character varying(255) NOT NULL,
    image_url character varying(255),
    activo boolean DEFAULT true NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


--
-- Name: logins_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.logins_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: logins_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.logins_id_seq OWNED BY public.logins.id;


--
-- Name: servicios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.servicios (
    id integer NOT NULL,
    nombre character varying(255) NOT NULL,
    cantidad numeric NOT NULL,
    descripcion character varying(255) NOT NULL,
    estado character varying(255) NOT NULL,
    total numeric NOT NULL,
    acuenta numeric NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


--
-- Name: servicios_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.servicios_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: servicios_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.servicios_id_seq OWNED BY public.servicios.id;


--
-- Name: usuario_formatos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuario_formatos (
    id integer NOT NULL,
    usuario_id integer NOT NULL,
    formato_id integer NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


--
-- Name: usuario_formatos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.usuario_formatos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: usuario_formatos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.usuario_formatos_id_seq OWNED BY public.usuario_formatos.id;


--
-- Name: AperturaCajas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AperturaCajas" ALTER COLUMN id SET DEFAULT nextval('public."AperturaCajas_id_seq"'::regclass);


--
-- Name: Cliente id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Cliente" ALTER COLUMN id SET DEFAULT nextval('public."Cliente_id_seq"'::regclass);


--
-- Name: Comprobante id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Comprobante" ALTER COLUMN id SET DEFAULT nextval('public."Comprobante_id_seq"'::regclass);


--
-- Name: ComunicacionBaja id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ComunicacionBaja" ALTER COLUMN id SET DEFAULT nextval('public."ComunicacionBaja_id_seq"'::regclass);


--
-- Name: ComunicacionBajaDetalle id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ComunicacionBajaDetalle" ALTER COLUMN id SET DEFAULT nextval('public."ComunicacionBajaDetalle_id_seq"'::regclass);


--
-- Name: Cuota id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Cuota" ALTER COLUMN id SET DEFAULT nextval('public."Cuota_id_seq"'::regclass);


--
-- Name: Detalle id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Detalle" ALTER COLUMN id SET DEFAULT nextval('public."Detalle_id_seq"'::regclass);


--
-- Name: DetalleAlmanaques id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DetalleAlmanaques" ALTER COLUMN id SET DEFAULT nextval('public."DetalleAlmanaques_id_seq"'::regclass);


--
-- Name: DetalleGuia id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DetalleGuia" ALTER COLUMN id SET DEFAULT nextval('public."DetalleGuia_id_seq"'::regclass);


--
-- Name: DetalleTickets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DetalleTickets" ALTER COLUMN id SET DEFAULT nextval('public."DetalleTickets_id_seq"'::regclass);


--
-- Name: Emisor id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Emisor" ALTER COLUMN id SET DEFAULT nextval('public."Emisor_id_seq"'::regclass);


--
-- Name: EnvioResumen id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EnvioResumen" ALTER COLUMN id SET DEFAULT nextval('public."EnvioResumen_id_seq"'::regclass);


--
-- Name: EnvioResumenDetalle iddetalle; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EnvioResumenDetalle" ALTER COLUMN iddetalle SET DEFAULT nextval('public."EnvioResumenDetalle_iddetalle_seq"'::regclass);


--
-- Name: GuiaRemision id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GuiaRemision" ALTER COLUMN id SET DEFAULT nextval('public."GuiaRemision_id_seq"'::regclass);


--
-- Name: Producto id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Producto" ALTER COLUMN id SET DEFAULT nextval('public."Producto_id_seq"'::regclass);


--
-- Name: Serie id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Serie" ALTER COLUMN id SET DEFAULT nextval('public."Serie_id_seq"'::regclass);


--
-- Name: Tickets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Tickets" ALTER COLUMN id SET DEFAULT nextval('public."Tickets_id_seq"'::regclass);


--
-- Name: almanaque id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.almanaque ALTER COLUMN id SET DEFAULT nextval('public.almanaque_id_seq'::regclass);


--
-- Name: egresos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.egresos ALTER COLUMN id SET DEFAULT nextval('public.egresos_id_seq'::regclass);


--
-- Name: formatos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.formatos ALTER COLUMN id SET DEFAULT nextval('public.formatos_id_seq'::regclass);


--
-- Name: ingresos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingresos ALTER COLUMN id SET DEFAULT nextval('public.ingresos_id_seq'::regclass);


--
-- Name: logins id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logins ALTER COLUMN id SET DEFAULT nextval('public.logins_id_seq'::regclass);


--
-- Name: servicios id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicios ALTER COLUMN id SET DEFAULT nextval('public.servicios_id_seq'::regclass);


--
-- Name: usuario_formatos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario_formatos ALTER COLUMN id SET DEFAULT nextval('public.usuario_formatos_id_seq'::regclass);


--
-- Name: AperturaCajas AperturaCajas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AperturaCajas"
    ADD CONSTRAINT "AperturaCajas_pkey" PRIMARY KEY (id);


--
-- Name: Cliente Cliente_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Cliente"
    ADD CONSTRAINT "Cliente_pkey" PRIMARY KEY (id);


--
-- Name: Comprobante Comprobante_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Comprobante"
    ADD CONSTRAINT "Comprobante_pkey" PRIMARY KEY (id);


--
-- Name: ComunicacionBajaDetalle ComunicacionBajaDetalle_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ComunicacionBajaDetalle"
    ADD CONSTRAINT "ComunicacionBajaDetalle_pkey" PRIMARY KEY (id);


--
-- Name: ComunicacionBaja ComunicacionBaja_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ComunicacionBaja"
    ADD CONSTRAINT "ComunicacionBaja_pkey" PRIMARY KEY (id);


--
-- Name: Cuota Cuota_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Cuota"
    ADD CONSTRAINT "Cuota_pkey" PRIMARY KEY (id);


--
-- Name: DetalleAlmanaques DetalleAlmanaques_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DetalleAlmanaques"
    ADD CONSTRAINT "DetalleAlmanaques_pkey" PRIMARY KEY (id);


--
-- Name: DetalleGuia DetalleGuia_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DetalleGuia"
    ADD CONSTRAINT "DetalleGuia_pkey" PRIMARY KEY (id);


--
-- Name: DetalleTickets DetalleTickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DetalleTickets"
    ADD CONSTRAINT "DetalleTickets_pkey" PRIMARY KEY (id);


--
-- Name: Detalle Detalle_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Detalle"
    ADD CONSTRAINT "Detalle_pkey" PRIMARY KEY (id);


--
-- Name: Emisor Emisor_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Emisor"
    ADD CONSTRAINT "Emisor_pkey" PRIMARY KEY (id);


--
-- Name: EnvioResumenDetalle EnvioResumenDetalle_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EnvioResumenDetalle"
    ADD CONSTRAINT "EnvioResumenDetalle_pkey" PRIMARY KEY (iddetalle);


--
-- Name: EnvioResumen EnvioResumen_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EnvioResumen"
    ADD CONSTRAINT "EnvioResumen_pkey" PRIMARY KEY (id);


--
-- Name: GuiaRemision GuiaRemision_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GuiaRemision"
    ADD CONSTRAINT "GuiaRemision_pkey" PRIMARY KEY (id);


--
-- Name: Moneda Moneda_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Moneda"
    ADD CONSTRAINT "Moneda_pkey" PRIMARY KEY (id);


--
-- Name: Producto Producto_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Producto"
    ADD CONSTRAINT "Producto_pkey" PRIMARY KEY (id);


--
-- Name: Serie Serie_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Serie"
    ADD CONSTRAINT "Serie_pkey" PRIMARY KEY (id);


--
-- Name: TablaParametrica TablaParametrica_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TablaParametrica"
    ADD CONSTRAINT "TablaParametrica_pkey" PRIMARY KEY (tipo, codigo);


--
-- Name: Tickets Tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Tickets"
    ADD CONSTRAINT "Tickets_pkey" PRIMARY KEY (id);


--
-- Name: TipoAfectacion TipoAfectacion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TipoAfectacion"
    ADD CONSTRAINT "TipoAfectacion_pkey" PRIMARY KEY (id);


--
-- Name: TipoComprobante TipoComprobante_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TipoComprobante"
    ADD CONSTRAINT "TipoComprobante_pkey" PRIMARY KEY (id);


--
-- Name: TipoDocumento TipoDocumento_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TipoDocumento"
    ADD CONSTRAINT "TipoDocumento_pkey" PRIMARY KEY (id);


--
-- Name: Unidad Unidad_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Unidad"
    ADD CONSTRAINT "Unidad_pkey" PRIMARY KEY (id);


--
-- Name: almanaque almanaque_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.almanaque
    ADD CONSTRAINT almanaque_pkey PRIMARY KEY (id);


--
-- Name: egresos egresos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.egresos
    ADD CONSTRAINT egresos_pkey PRIMARY KEY (id);


--
-- Name: formatos formatos_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.formatos
    ADD CONSTRAINT formatos_key_key UNIQUE (key);


--
-- Name: formatos formatos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.formatos
    ADD CONSTRAINT formatos_pkey PRIMARY KEY (id);


--
-- Name: ingresos ingresos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingresos
    ADD CONSTRAINT ingresos_pkey PRIMARY KEY (id);


--
-- Name: logins logins_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logins
    ADD CONSTRAINT logins_pkey PRIMARY KEY (id);


--
-- Name: servicios servicios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.servicios
    ADD CONSTRAINT servicios_pkey PRIMARY KEY (id);


--
-- Name: usuario_formatos usuario_formatos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario_formatos
    ADD CONSTRAINT usuario_formatos_pkey PRIMARY KEY (id);


--
-- Name: usuario_formatos usuario_formatos_usuario_id_formato_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario_formatos
    ADD CONSTRAINT usuario_formatos_usuario_id_formato_id_key UNIQUE (usuario_id, formato_id);


--
-- Name: Cliente Cliente_tipo_documento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Cliente"
    ADD CONSTRAINT "Cliente_tipo_documento_id_fkey" FOREIGN KEY (tipo_documento_id) REFERENCES public."TipoDocumento"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Comprobante Comprobante_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Comprobante"
    ADD CONSTRAINT "Comprobante_cliente_id_fkey" FOREIGN KEY (cliente_id) REFERENCES public."Cliente"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Comprobante Comprobante_comprobante_ref_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Comprobante"
    ADD CONSTRAINT "Comprobante_comprobante_ref_id_fkey" FOREIGN KEY (comprobante_ref_id) REFERENCES public."Comprobante"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Comprobante Comprobante_emisor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Comprobante"
    ADD CONSTRAINT "Comprobante_emisor_id_fkey" FOREIGN KEY (emisor_id) REFERENCES public."Emisor"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Comprobante Comprobante_moneda_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Comprobante"
    ADD CONSTRAINT "Comprobante_moneda_id_fkey" FOREIGN KEY (moneda_id) REFERENCES public."Moneda"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Comprobante Comprobante_serie_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Comprobante"
    ADD CONSTRAINT "Comprobante_serie_id_fkey" FOREIGN KEY (serie_id) REFERENCES public."Serie"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Comprobante Comprobante_tipo_comprobante_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Comprobante"
    ADD CONSTRAINT "Comprobante_tipo_comprobante_id_fkey" FOREIGN KEY (tipo_comprobante_id) REFERENCES public."TipoComprobante"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ComunicacionBajaDetalle ComunicacionBajaDetalle_baja_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ComunicacionBajaDetalle"
    ADD CONSTRAINT "ComunicacionBajaDetalle_baja_id_fkey" FOREIGN KEY (baja_id) REFERENCES public."ComunicacionBaja"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ComunicacionBajaDetalle ComunicacionBajaDetalle_comprobante_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ComunicacionBajaDetalle"
    ADD CONSTRAINT "ComunicacionBajaDetalle_comprobante_id_fkey" FOREIGN KEY (comprobante_id) REFERENCES public."Comprobante"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ComunicacionBaja ComunicacionBaja_emisor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ComunicacionBaja"
    ADD CONSTRAINT "ComunicacionBaja_emisor_id_fkey" FOREIGN KEY (emisor_id) REFERENCES public."Emisor"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Cuota Cuota_comprobante_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Cuota"
    ADD CONSTRAINT "Cuota_comprobante_id_fkey" FOREIGN KEY (comprobante_id) REFERENCES public."Comprobante"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DetalleAlmanaques DetalleAlmanaques_AlmanaqueId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DetalleAlmanaques"
    ADD CONSTRAINT "DetalleAlmanaques_AlmanaqueId_fkey" FOREIGN KEY ("AlmanaqueId") REFERENCES public.almanaque(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: DetalleGuia DetalleGuia_guia_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DetalleGuia"
    ADD CONSTRAINT "DetalleGuia_guia_id_fkey" FOREIGN KEY (guia_id) REFERENCES public."GuiaRemision"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DetalleGuia DetalleGuia_unidad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DetalleGuia"
    ADD CONSTRAINT "DetalleGuia_unidad_id_fkey" FOREIGN KEY (unidad_id) REFERENCES public."Unidad"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DetalleTickets DetalleTickets_ticketId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DetalleTickets"
    ADD CONSTRAINT "DetalleTickets_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES public."Tickets"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Detalle Detalle_comprobante_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Detalle"
    ADD CONSTRAINT "Detalle_comprobante_id_fkey" FOREIGN KEY (comprobante_id) REFERENCES public."Comprobante"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Detalle Detalle_producto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Detalle"
    ADD CONSTRAINT "Detalle_producto_id_fkey" FOREIGN KEY (producto_id) REFERENCES public."Producto"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: EnvioResumenDetalle EnvioResumenDetalle_comprobante_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EnvioResumenDetalle"
    ADD CONSTRAINT "EnvioResumenDetalle_comprobante_id_fkey" FOREIGN KEY (comprobante_id) REFERENCES public."Comprobante"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: EnvioResumenDetalle EnvioResumenDetalle_envio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EnvioResumenDetalle"
    ADD CONSTRAINT "EnvioResumenDetalle_envio_id_fkey" FOREIGN KEY (envio_id) REFERENCES public."EnvioResumen"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: EnvioResumen EnvioResumen_emisor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EnvioResumen"
    ADD CONSTRAINT "EnvioResumen_emisor_id_fkey" FOREIGN KEY (emisor_id) REFERENCES public."Emisor"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: GuiaRemision GuiaRemision_comprobante_rel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GuiaRemision"
    ADD CONSTRAINT "GuiaRemision_comprobante_rel_id_fkey" FOREIGN KEY (comprobante_rel_id) REFERENCES public."Comprobante"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: GuiaRemision GuiaRemision_destinatario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GuiaRemision"
    ADD CONSTRAINT "GuiaRemision_destinatario_id_fkey" FOREIGN KEY (destinatario_id) REFERENCES public."Cliente"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: GuiaRemision GuiaRemision_emisor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."GuiaRemision"
    ADD CONSTRAINT "GuiaRemision_emisor_id_fkey" FOREIGN KEY (emisor_id) REFERENCES public."Emisor"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Producto Producto_tipo_afectacion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Producto"
    ADD CONSTRAINT "Producto_tipo_afectacion_id_fkey" FOREIGN KEY (tipo_afectacion_id) REFERENCES public."TipoAfectacion"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Producto Producto_unidad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Producto"
    ADD CONSTRAINT "Producto_unidad_id_fkey" FOREIGN KEY (unidad_id) REFERENCES public."Unidad"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Serie Serie_tipo_comprobante_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Serie"
    ADD CONSTRAINT "Serie_tipo_comprobante_id_fkey" FOREIGN KEY (tipo_comprobante_id) REFERENCES public."TipoComprobante"(id);


--
-- Name: usuario_formatos usuario_formatos_formato_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario_formatos
    ADD CONSTRAINT usuario_formatos_formato_id_fkey FOREIGN KEY (formato_id) REFERENCES public.formatos(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: usuario_formatos usuario_formatos_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario_formatos
    ADD CONSTRAINT usuario_formatos_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.logins(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--


