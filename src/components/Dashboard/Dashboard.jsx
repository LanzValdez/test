import React, { useState, useEffect, useMemo, useRef } from "react";
import {
    InputSelect,
    Button,
    Tabs,
    Table,
    Input,
    Chip,
    Loader,
    Toast,
    NoContent,
    Slider,
    ToggleSwitch
} from "@supportninja/ui-components";
import {
    RadialBarChart,
    RadialBar,
    BarChart,
    Bar,
    XAxis,
    Cell,
    YAxis,
    PolarAngleAxis,
    CartesianGrid,
    Tooltip,
    LabelList,
    ResponsiveContainer,
} from "recharts";
import auditIcon from "../../assets/icons/audit.svg";
import qualityIcon from "../../assets/icons/quality.svg";
import neutralIcon from "../../assets/icons/neutral.svg";
import positiveIcon from "../../assets/icons/positive.svg";
import negativeIcon from "../../assets/icons/negative.svg";
import manualScoreIcon from "../../assets/icons/manual-score.svg";
import filterIcon from "../../assets/icons/filter.svg";
import searchIcon from "../../assets/icons/search.svg";

import "./dashboard.css";
import DateRangePicker from "../common/DateRangePicker";
import { format, parseISO, set } from "date-fns";
import { sortBy, toTitleCase } from "../common/strings";
import eyeLogo from "../../assets/icons/eye.svg";
import openNewTab from "../../assets/icons/new-tab.svg";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../../api/axios";
import "../Evaluation/evaluation.css";
import MetricsDetails from "./MetricsDetails";
import { decompressGzip } from "../../utlis/decompress";
import { sendEventToApi } from "../../utlis/analytics";

const GOOGLE_CLIENT_ID =
    "106603981486-qpkulg9imin5t1jl89ab7hjlhci5fani.apps.googleusercontent.com";

const Dashboard = () => {
    const [accountName, setAccountName] = useState(null);
    const [agentName, setAgentName] = useState(null);
    const [agents, setAgents] = useState([]);
    const navigate = useNavigate();
    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [metricsData, setMetricsData] = useState(null);
    const [sentimentFilter, setSentimentFilter] = useState(null);

    const [activeTab, setActiveTab] = useState(0);
    const [toast, setToast] = useState(null);
    const showToast = (msg, opts = {}) => setToast({ message: msg, ...opts });
    const location = useLocation();

    useEffect(() => {
        (async () => {
            const savedAccount = localStorage.getItem("selectedAccount");
            const savedStartDate = localStorage.getItem("selectedStartDate");
            const savedEndDate = localStorage.getItem("selectedEndDate");

            await fetchAccounts();
            if (savedAccount) {
                await fetchAgents(savedAccount);
            }
            if (savedStartDate) setStartDate(new Date(savedStartDate));
            if (savedEndDate) setEndDate(new Date(savedEndDate));
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (
            accountName &&
            agentName &&
            startDate &&
            endDate &&
            accounts.length > 0 &&
            agents.length > 0
        ) {
            handleFetchMetrics();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.pathname, accountName, agentName, startDate, endDate, accounts, agents]);

    const fetchAccounts = async () => {
        setLoading(true);
        try {
            const response = await api.get("/qa/accounts");
            const data = response.data?.account_details || [];
            setAccounts(sortBy(data, "account_name", { order: "asc" }));
            const savedAccount = localStorage.getItem("selectedAccount");
            if (savedAccount) setAccountName(savedAccount);
        } catch (error) {
            console.error("Error fetching accounts:", error);
            showToast("Error in fetching the accounts data", {
                type: "error",
                duration: 4000,
                position: "bottom-right",
                onClose: () => setToast(null),
            });
        } finally {
            setLoading(false);
        }
    };

    const fetchAgents = async (accountId) => {
        setLoading(true);
        try {
            const response = await api.get(`/qa/agents?accountId=${accountId}`);
            const data = response.data?.agent_details || [];
            setAgents(data);
            const savedAgent = localStorage.getItem("selectedAgent");
            if (savedAgent) {
                const parsedAgent = JSON.parse(savedAgent);
                if (Array.isArray(parsedAgent)) {
                    setAgentName(parsedAgent);
                }
            }
        } catch (error) {
            console.error("Error fetching agents:", error);
            showToast("Error in fetching the agents data", {
                type: "error",
                duration: 4000,
                position: "bottom-right",
                onClose: () => setToast(null),
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!accountName) return;
        if (localStorage.getItem("selectedAccount") !== accountName) {
            localStorage.setItem("selectedAccount", accountName);
        }
    }, [accountName]);

    useEffect(() => {
        if (!agentName) return;
        const storedAgent = localStorage.getItem("selectedAgent");
        const currentAgent = JSON.stringify(agentName);
        if (storedAgent !== currentAgent) {
            localStorage.setItem("selectedAgent", currentAgent);
        }
    }, [agentName]);

    useEffect(() => {
        if (startDate) {
            const startDateString = startDate.toISOString();
            if (localStorage.getItem("selectedStartDate") !== startDateString) {
                localStorage.setItem("selectedStartDate", startDateString);
            }
        }
        if (endDate) {
            const endDateString = endDate.toISOString();
            if (localStorage.getItem("selectedEndDate") !== endDateString) {
                localStorage.setItem("selectedEndDate", endDateString);
            }
        }
    }, [startDate, endDate]);

    const handleAccountChange = (value) => {
        setAccountName(value);
        setAgentName(null);
        fetchAgents(value);
    };

    const navigateWithFilters = () => {
        setActiveTab(3);
    };

    const handleFetchMetrics = async () => {
        setLoading(true);

        (async () => {
            const payloadContext = {
                email: localStorage.getItem("userEmail"),
                page: "dashboard",
                selectedAccount: accountName,
                selectedAgents: Array.isArray(agentName) ? agentName : [agentName],
                agentCount: Array.isArray(agentName) ? agentName.length : 1,
                startDate: startDate ? format(new Date(startDate), "yyyy-MM-dd") : null,
                endDate: endDate ? format(new Date(endDate), "yyyy-MM-dd") : null,
            };
            await sendEventToApi("filterMetrics", payloadContext);
        })();

        try {
            const response = await api.post("/qa/query", {
                eventType: "get_totals",
                userId: localStorage.getItem("userEmail"),
                account_id: accountName,
                position_ids: agentName,
                startDate: startDate ? format(new Date(startDate), "yyyy-MM-dd") : "",
                endDate: endDate ? format(new Date(endDate), "yyyy-MM-dd") : "",
            });
            const decompressed = await decompressGzip(response);
            console.log({ decompressed });
            setMetricsData(decompressed?.metrics || null);
        } catch (error) {
            console.error("Error fetching metrics:", error);
            showToast("Error in fetching the metrics data", {
                type: "error",
                duration: 4000,
                position: "bottom-right",
                onClose: () => setToast(null),
            });
        } finally {
            setLoading(false);
        }
    };

    const COLORS = ["#BF83FF", "#FF947A", "#6993FF"];

    const agentQualityColumns = [
        { header: "Name", accessor: "agent_name", sortable: true },
        {
            header: "Audit Count",
            accessor: "audit_count",
            sortable: true,
            sortType: "number",
        },
        {
            header: "QA Score",
            accessor: "average_qa_score",
            sortable: true,
            sortType: "number",
        },
        {
            header: "# of Positive",
            accessor: "positive_interactions",
            sortable: true,
            sortType: "number",
        },
        {
            header: "# of Neutral",
            accessor: "neutral_interactions",
            sortable: true,
            sortType: "number",
        },
        {
            header: "# of Negative",
            accessor: "negative_interactions",
            sortable: true,
            sortType: "number",
        },
    ];

    const DigitalQABoards = () => {
        const stats = {
            total_audits: metricsData?.total_audits,
            total_manual_audits: metricsData?.total_manual_audits,
            average_qa_percentage: metricsData?.average_qa_percentage,
            total_neutral_interactions: metricsData?.total_neutral_interactions,
            total_positive_interactions: metricsData?.total_positive_interactions,
            total_negative_interactions: metricsData?.total_negative_interactions,
            average_manual_score: metricsData?.average_manual_score,
            average_quality_score: metricsData?.average_quality_score,
            manual_coverage_percentage: metricsData?.manual_coverage_percentage,
        };

        const cardConfig = [
            {
                icon: (
                    <img
                        src={auditIcon}
                        className="w-10 h-10 text-[#4A90E2]"
                        alt="Audit Icon"
                    />
                ),
                valueKey: "total_audits",
                label: "Number of Audits",
                bg: "bg-[#6993FF33]",
                glow: "rgba(105,147,255,0.55)",
                header: "Audits",
                renderValues: () => {
                    return (
                        <div className="text-[#425166] text-base mt-2">
                            <div>
                                <span className="font-light">Total Audits:</span>{" "}
                                <span className="font-bold">{stats.total_audits}</span>
                            </div>
                            <div>
                                <span className="font-light">Total Manual Audits:</span>{" "}
                                <span className="font-bold">{stats.total_manual_audits}</span>
                            </div>
                        </div>
                    );
                },
                onClick: () => navigateWithFilters(),
            },
            {
                icon: (
                    <img
                        src={qualityIcon}
                        className="w-10 h-10 text-[#FF8C5B]"
                        alt="Quality Icon"
                    />
                ),
                valueKey: "average_qa_percentage",
                label: "Quality Score",
                bg: "bg-[#FFF4DE]",
                header: "Score",
                glow: "rgba(227,183,77,0.55)",
                renderValues: () => {
                    return (
                        <div className="text-[#425166] text-base mt-2">
                            <div>
                                <span className="font-light">Average AI Score:</span>{" "}
                                <span className="font-bold">
                                    {stats.average_quality_score}
                                </span>
                            </div>
                            <div>
                                <span className="font-light">Average Manual Score:</span>{" "}
                                <span className="font-bold">
                                    {stats.average_manual_score}
                                </span>
                            </div>
                        </div>
                    );
                },
                onClick: () => navigateWithFilters(),
            },
            {
                icon: (
                    <img
                        src={manualScoreIcon}
                        className="w-10 h-10 text-[#FF8C5B]"
                        alt="Manual Score Icon"
                    />
                ),
                valueKey: "average_manual_score",
                label: "Manual Score",
                bg: "bg-[#C6E8F3]",
                header: "Manual Coverage",
                glow: "rgba(59, 167, 194, 0.55)",
                renderValues: () => {
                    return (
                        <div className="text-[#425166] mt-2">
                            <span className="text-base font-light">
                                Coverage Percentage:{" "}
                                <span className="font-bold">
                                    {stats.manual_coverage_percentage}
                                </span>
                                %
                            </span>
                        </div>
                    );
                },
                onClick: () => navigateWithFilters(),
            },
            {
                icon: (
                    <img
                        src={neutralIcon}
                        className="w-10 h-10 text-[#B18AFF]"
                        alt="Neutral Icon"
                    />
                ),
                valueKey: "total_neutral_interactions",
                label: "Neutral Interaction",
                header: "Neutral Interactions",
                bg: "bg-[#F3E8FF]",
                glow: "rgba(177,138,255,0.55)",
                onClick: () => {
                    setSentimentFilter("neutral");
                    setActiveTab(3);
                },
                renderValues: () => {
                    return (
                        <div className="text-[#425166] font-bold text-xl w-full flex justify-center items-center">
                            {stats.total_neutral_interactions}
                        </div>
                    );
                },
            },
            {
                icon: (
                    <img
                        src={positiveIcon}
                        className="w-10 h-10 text-[#4ADE80]"
                        alt="Positive Icon"
                    />
                ),
                valueKey: "total_positive_interactions",
                label: "Positive Interaction",
                header: "Positive Interactions",
                bg: "bg-[#DCFCE7]",
                glow: "rgba(74,222,128,0.55)",
                onClick: () => {
                    setSentimentFilter("positive");
                    setActiveTab(3);
                },
                renderValues: () => {
                    return (
                        <div className="text-[#425166] w-full font-bold text-xl flex justify-center items-center">
                            {stats.total_positive_interactions}
                        </div>
                    );
                },
            },
            {
                icon: (
                    <img
                        src={negativeIcon}
                        className="w-10 h-10 text-[#FF5B5B]"
                        alt="Negative Icon"
                    />
                ),
                valueKey: "total_negative_interactions",
                label: "Negative Interaction",
                header: "Negative Interactions",
                bg: "bg-[#FFE2E5]",
                glow: "rgba(255,91,91,0.55)",
                onClick: () => {
                    setSentimentFilter("negative");
                    setActiveTab(3);
                },
                renderValues: () => {
                    return (
                        <div className="text-[#425166] w-full font-bold text-xl flex justify-center items-center">
                            {stats.total_negative_interactions}
                        </div>
                    );
                },
            },
        ];

        return (
            <div className="m-4">
                <div>
                    <div className="font-bold text-[20px] leading-[32px] tracking-normal text-[#05004E]">
                        Digital Quality Audit Boards
                    </div>
                    <div className="font-medium text-[16px] leading-[30px] tracking-normal text-[#737791]">
                        Audit Summary
                    </div>
                </div>
                <div className="grid mx-2 gap-y-8 mt-6 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 w-full">
                    {cardConfig.map((card, idx) => (
                        <div
                            key={idx}
                            onClick={card.onClick}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    card.onClick();
                                }
                            }}
                            className={`group relative flex flex-col items-start p-8 rounded-2xl w-full ${card.bg}
                                transition-all duration-300 ease-out hover:-translate-y-1
                                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 cursor-pointer`}
                            style={{ "--glow": card.glow }}
                            role="button"
                            tabIndex={0}
                        >
                            <div
                                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                                style={{ boxShadow: "0 0 0 0 rgba(0,0,0,0)" }}
                            />
                            <div
                                className="absolute inset-0 rounded-2xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                                style={{ boxShadow: "0 0 12px 6px var(--glow)" }}
                            />

                            <div className="mb-2 flex justify-center items-center transition-transform duration-300 ease-out group-hover:scale-105">
                                {card.icon}{" "}
                                <span className="text-xl font-bold ml-4">
                                    {card?.header}
                                </span>
                            </div>
                            {card.renderValues?.()}
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const formatTimestamp = (timestamp) => {
        return format(parseISO(timestamp), "dd MMMM yyyy, hh:mm a");
    };

    const RecentEvaluation = () => {
        const [search, setSearch] = useState("");
        const [openDrawer, setOpenDrawer] = useState({ open: false, data: null });
        const [scoreValue, setScoreValue] = useState(8);
        const [manualScore, setManualScore] = useState(false);
        const [isOpen, setIsOpen] = useState(false);
        const panelRef = useRef(null);

        useEffect(() => {
            if (!isOpen) return;

            const handleOutsideClick = (event) => {
                if (panelRef.current && !panelRef.current.contains(event.target)) {
                    setIsOpen(false);
                }
            };

            document.addEventListener("mousedown", handleOutsideClick);
            return () => document.removeEventListener("mousedown", handleOutsideClick);
        }, [isOpen]);

        const recentEvaluationColumns = [
            {
                header: "Ticket ID",
                accessor: "ticket_id",
                sortable: true,
                render: ({ row }) => {
                    const ticketId = row?.ticket_id;
                    const displayTicketId =
                        typeof ticketId === "string" && ticketId.length > 8
                            ? `${ticketId.slice(0, 8)}...`
                            : ticketId || "-";
                    return (
                        <span
                            onClick={() => {
                                if (ticketId) {
                                    const positionId = Array.isArray(row.position_id)
                                        ? row.position_id[0]
                                        : row.position_id;

                                    const accountId =
                                        row.account_id ||
                                        accountName ||
                                        localStorage.getItem("selectedAccount");
                                    localStorage.setItem("currentAgent", positionId);
                                    localStorage.setItem("ticket", ticketId);
                                    navigate("/quality-form", {
                                        state: {
                                            accountId,
                                            positionId,
                                            ticketId,
                                        },
                                    });
                                }
                            }}
                            className={`relative cursor-pointer text-blue-700 font-medium inline-block group ${ticketId
                                    ? ""
                                    : "pointer-events-none text-gray-500"
                                }`}
                        >
                            <span className="flex gap-1">
                                {displayTicketId}{" "}
                                {ticketId && (
                                    <img
                                        src={openNewTab}
                                        alt="View details"
                                        className="cursor-pointer w-4 h-4"
                                    />
                                )}
                            </span>
                            {ticketId && (
                                <span className="absolute left-0 bottom-0 h-[1.5px] w-0 bg-blue-700 transition-all duration-300 group-hover:w-full" />
                            )}
                        </span>
                    );
                },
            },
            {
                header: "QA Score",
                accessor: "qa_score",
                sortable: true,
                render: ({ row }) => row.qa_score || "N/A",
            },
            {
                header: "Manual QA Score",
                accessor: "manual_qa_score",
                sortable: true,
                render: ({ row }) => row.manual_qa_score || "-",
            },
            { header: "Agent Name", accessor: "assignee_name", sortable: true },
            {
                header: "Created Date",
                accessor: "created_at",
                sortable: true,
                render: ({ row }) => formatTimestamp(row.created_at),
            },
            {
                header: "Sentiment",
                accessor: "sentiment",
                sortable: true,
                render: ({ row }) => (
                    <Chip
                        variant={
                            row.sentiment === "positive"
                                ? "success"
                                : row.sentiment === "negative"
                                    ? "error"
                                    : "processing"
                        }
                    >
                        {toTitleCase(row.sentiment || "")}
                    </Chip>
                ),
            },
            { header: "Customer Issue", accessor: "issue", sortable: true },
            {
                header: "Actions",
                accessor: "actions",
                render: ({ row }) => (
                    <img
                        src={eyeLogo}
                        alt="View details"
                        className="cursor-pointer w-6 h-6"
                        onClick={() => {
                            setOpenDrawer({ open: true, data: row });
                        }}
                    />
                ),
            },
        ];

        const visibleAccessors = recentEvaluationColumns.map((col) => col.accessor);
        const filteredTickets = useMemo(() => {
            const rows = metricsData?.tickets || [];
            const bySentiment = sentimentFilter
                ? rows.filter(
                    (r) =>
                        String(r.sentiment || "").toLowerCase() ===
                        sentimentFilter
                )
                : rows;
            const lower = search?.toLowerCase?.() || "";
            let filtered = !lower
                ? bySentiment
                : bySentiment.filter((row) =>
                    visibleAccessors.some((accessor) => {
                        const val = row[accessor];
                        if (val === null || val === undefined) return false;
                        return String(val).toLowerCase().includes(lower);
                    })
                );
            if (manualScore) {
                filtered = filtered.filter((row) => {
                    const raw = row.manual_qa_score;
                    if (
                        raw === null ||
                        raw === undefined ||
                        raw === ""
                    )
                        return false;
                    const score = Number(raw);
                    return !Number.isNaN(score);
                });
            }
            if (
                scoreValue !== null &&
                scoreValue !== undefined &&
                scoreValue !== ""
            ) {
                filtered = filtered.filter((row) => {
                    const raw = row.qa_score ?? row.manual_qa_score;
                    if (
                        raw === null ||
                        raw === undefined ||
                        raw === ""
                    )
                        return false;
                    const score = Number(raw);
                    if (Number.isNaN(score)) return false;
                    return score <= Number(scoreValue);
                });
            }

            return filtered;
        }, [search, metricsData, sentimentFilter, scoreValue, manualScore]);

        return (
            <div className="m-4">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                    <div className="mt-6">
                        <div className="font-bold text-[20px] leading-[32px] tracking-normal text-[#05004E]">
                            Recent Evaluations
                        </div>
                        <div className="font-medium text-[16px] leading-[30px] tracking-normal text-[#737791]">
                            Audit Summary
                        </div>
                    </div>
                    <div>
                        <div className="flex items-center justify-end">
                            <div>
                                <Input
                                    label=""
                                    value={search}
                                    onChange={(e) =>
                                        setSearch(e.target.value)
                                    }
                                    placeholder="Search..."
                                    className="[&_.input-field]:rounded-2xl"
                                    error={""}
                                />
                            </div>
                            <div className="m-4 relative inline-block float-right">
                                <Button
                                    onClick={() =>
                                        setIsOpen((prev) => !prev)
                                    }
                                    className="btn-secondary-active flex !px-6 !py-2"
                                >
                                    <img
                                        src={filterIcon}
                                        className="text-[#FF8C5B] mr-2"
                                        alt="Filter Icon"
                                    />
                                    Filters
                                </Button>
                                {isOpen && (
                                    <div
                                        ref={panelRef}
                                        className="absolute right-0 z-20 mt-3 w-72 rounded-2xl border border-slate-200 bg-white m-6 p-4 shadow-xl"
                                    >
                                        <div className="flex flex-col gap-2">
                                            <section>
                                                <div className="flex items-center justify-between text-sm font-medium text-slate-600">
                                                    <span>Score Filter</span>
                                                    <span className="text-slate-400">
                                                        0 — 8
                                                    </span>
                                                </div>
                                                <div className="flex-[1]">
                                                    <Slider
                                                        min={0}
                                                        max={8}
                                                        defaultValue={
                                                            scoreValue
                                                        }
                                                        onChange={
                                                            setScoreValue
                                                        }
                                                        label="Score"
                                                        className={"!p-1"}
                                                    />
                                                    <hr className="my-2" />
                                                </div>
                                            </section>
                                            <section className="flex items-center justify-between rounded-xl py-2">
                                                <div className="w-full rounded-2x">
                                                    <div className="flex w-full items-center justify-between gap-4">
                                                        <div className="flex min-w-0 flex-col text-slate-700">
                                                            <span className="text-base text-black">
                                                                Manual
                                                                Score
                                                            </span>
                                                            <span className="text-sm text-slate-500">
                                                                {manualScore
                                                                    ? "On"
                                                                    : "Off"}
                                                            </span>
                                                        </div>

                                                        <ToggleSwitch
                                                            id="manual-score"
                                                            label=""
                                                            checked={
                                                                manualScore
                                                            }
                                                            onChange={
                                                                setManualScore
                                                            }
                                                            className="shrink-0"
                                                        />
                                                    </div>
                                                    <hr className="my-2" />
                                                </div>
                                            </section>
                                            <div className="flex items-center justify-center">
                                                <Button
                                                    onClick={() => {
                                                        setSearch("");
                                                        setScoreValue(8);
                                                        setManualScore(
                                                            false
                                                        );
                                                        setSentimentFilter(
                                                            null
                                                        );
                                                    }}
                                                    className="btn-default-active !px-5 !py-2"
                                                >
                                                    Clear Filters
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                <Table
                    columns={recentEvaluationColumns}
                    data={filteredTickets || []}
                    pagination={{ pageSize: 10 }}
                    className="!w-full [&_thead]:text-[14px]
                               [&_tbody]:w-full [&_tbody]:text-sm table-scroll"
                />
                {openDrawer.open && (
                    <MetricsDetails
                        open={openDrawer.open}
                        onClose={() =>
                            setOpenDrawer({ open: false, data: null })
                        }
                        openDrawer={openDrawer}
                    />
                )}
            </div>
        );
    };

    const AgentQualityAudit = () => {
        const [search, setSearch] = useState("");
        const visibleAccessors = agentQualityColumns.map(
            (col) => col.accessor
        );
        const filteredMetrics = useMemo(() => {
            if (!search) return metricsData?.agent_metrics || [];
            const lower = search.toLowerCase();
            return (metricsData?.agent_metrics || []).filter((row) =>
                visibleAccessors.some((accessor) => {
                    const val = row[accessor];
                    if (val === null || val === undefined) return false;
                    return String(val).toLowerCase().includes(lower);
                })
            );
        }, [search, metricsData]);
        return (
            <div className="m-4">
                <div className="mt-6">
                    <div className="font-bold text-[20px] leading-[32px] tracking-normal text-[#05004E]">
                        Agent Quality Audit
                    </div>
                    <div className="font-medium text-[16px] leading-[30px] tracking-normal text-[#737791]">
                        Audit Summary
                    </div>
                </div>
                <div className="mb-4 flex justify-end min-w-[280px]">
                    <Input
                        label=""
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search..."
                        error={""}
                    />
                </div>
                <Table
                    columns={agentQualityColumns}
                    data={filteredMetrics || []}
                    pagination={{ pageSize: 10 }}
                    className="!w-full [&_thead]:text-[14px]
                               [&_tbody]:w-full [&_tbody]:text-sm "
                />
            </div>
        );
    };

    function toRadialBarData(obj) {
        return Object.entries(obj).map(([name, value], idx) => ({
            name,
            value,
            fill: COLORS[idx % COLORS.length],
        }));
    }

    function CriticalChart({ data, title, delay = 0 }) {
        const radialData = React.useMemo(
            () => toRadialBarData(data),
            [data]
        );
        const [visible, setVisible] = React.useState(false);

        React.useEffect(() => {
            const t = setTimeout(() => setVisible(true), delay);
            return () => clearTimeout(t);
        }, [delay]);

        return (
            <div
                className={`bg-white rounded-xl shadow p-4 transition-opacity duration-400 ease-out
                  ${visible ? "opacity-100" : "opacity-0"}`}
            >
                <h3 className="font-semibold mb-2">{title}</h3>

                <div className="flex items-center gap-4">
                    <div className="flex-1">
                        <RadialBarChart
                            width={220}
                            height={220}
                            cx="50%"
                            cy="50%"
                            innerRadius={10}
                            outerRadius={100}
                            barSize={6}
                            data={radialData}
                        >
                            <PolarAngleAxis
                                type="number"
                                domain={[0, 100]}
                                angleAxisId={0}
                                tick={false}
                            />
                            <RadialBar
                                minAngle={4}
                                clockWise
                                dataKey="value"
                                background
                                isAnimationActive={true}
                                animationBegin={delay + 80}
                                animationDuration={520}
                                animationEasing="ease-out"
                                cornerRadius={6}
                            />
                        </RadialBarChart>
                    </div>

                    <div className="flex-1 flex items-start">
                        <ul className="mt-2 space-y-1 text-sm w-full">
                            {Object.entries(data).map(
                                ([key, value], idx) => (
                                    <li
                                        key={key}
                                        className="flex flex-col items-start gap-2"
                                        style={{
                                            opacity: 0,
                                            animation: `legendFade 320ms ${delay +
                                                140 +
                                                idx * 60
                                                }ms ease-out forwards`,
                                        }}
                                    >
                                        <span className="flex items-center">
                                            <span
                                                className="inline-block w-3 h-3 rounded-full"
                                                style={{
                                                    background:
                                                        COLORS[
                                                        idx %
                                                        COLORS.length
                                                        ],
                                                }}
                                            />
                                            <span className="capitalize text-[#83868E] mx-4">
                                                {key.replace(
                                                    /_/g,
                                                    " "
                                                )}
                                            </span>
                                        </span>
                                        <span className="font-semibold w-full flex justify-center">
                                            {Math.round(value)}%
                                        </span>
                                    </li>
                                )
                            )}
                        </ul>
                    </div>
                </div>
            </div>
        );
    }

    const CriticalMetrics = () => {
        const baseDelay = 0;
        const step = 160;

        return (
            <div className="m-4">
                <div className="my-6">
                    <div className="font-bold text-[20px] leading-[32px] tracking-normal text-[#05004E]">
                        Critical Metrics
                    </div>
                    <div className="font-medium text-[16px] leading-[30px] tracking-normal text-[#737791]">
                        Audit Summary for Customer Critical, Business Critical
                        and Non Critical
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <CriticalChart
                        data={metricsData?.customer_critical ?? {}}
                        title="Customer Critical"
                        delay={baseDelay + step * 0}
                    />
                    <CriticalChart
                        data={metricsData?.business_critical ?? {}}customer_critical
                        title="Business Critical"
                        delay={baseDelay + step * 1}
                    />
                    <CriticalChart
                        data={metricsData?.non_critical ?? {}}
                        title="Non Critical"
                        delay={baseDelay + step * 2}
                    />
                </div>
            </div>
        );
    };

    const BarChartGraph = () => {
        const [isVisible, setIsVisible] = useState(false);
        const [dqSort, setDqSort] = useState("none");
        const [mdSort, setMdSort] = useState("none");
        const [agentSort, setAgentSort] = useState("none");

        const PRIMARY_COLOR = "#ef4444";
        const SECONDARY_COLOR = "#eebc4f";
        const NEUTRAL_COLOR = "#6B7280";

        useEffect(() => {
            const timer = setTimeout(() => setIsVisible(true), 40);
            return () => clearTimeout(timer);
        }, []);

        const formatPercentLabel = (v) =>
            `${Number(v || 0).toFixed(1)}%`;

        const combinedData = useMemo(() => {
            return [
                ...Object.entries(
                    metricsData?.business_critical || {}
                ).map(([key, value]) => {
                    const numeric = Number(value) || 0;
                    return {
                        name: key.replace(/_/g, " "),
                        value: numeric,
                        displayValue: formatPercentLabel(numeric),
                        category: "Business Critical",
                    };
                }),
                ...Object.entries(
                    metricsData?.customer_critical || {}
                ).map(([key, value]) => {
                    const numeric = Number(value) || 0;
                    return {
                        name: key.replace(/_/g, " "),
                        value: numeric,
                        displayValue: formatPercentLabel(numeric),
                        category: "Customer Critical",
                    };
                }),
                ...Object.entries(
                    metricsData?.non_critical || {}
                ).map(([key, value]) => {
                    const numeric = Number(value) || 0;
                    return {
                        name: key.replace(/_/g, " "),
                        value: numeric,
                        displayValue: formatPercentLabel(numeric),
                        category: "Non Critical",
                    };
                }),
            ];
        }, [metricsData]);

        const COLORS_MAP = {
            "Business Critical": PRIMARY_COLOR,
            "Customer Critical": SECONDARY_COLOR,
            "Non Critical": NEUTRAL_COLOR,
        };

        const dqData = useMemo(() => {
            const arr = [...combinedData];
            if (dqSort === "asc") arr.sort((a, b) => a.value - b.value);
            else if (dqSort === "desc")
                arr.sort((a, b) => b.value - a.value);
            return arr;
        }, [combinedData, dqSort]);

        const markdownBaseData = useMemo(() => {
            return combinedData.map((item) => {
                const base = Number(item.value) || 0;
                const v = 100 - base;
                const numeric = v < 0 ? 0 : v;
                return {
                    ...item,
                    value: numeric,
                    displayValue: formatPercentLabel(numeric),
                };
            });
        }, [combinedData]);

        const markdownData = useMemo(() => {
            const arr = [...markdownBaseData];
            if (mdSort === "asc") arr.sort((a, b) => a.value - b.value);
            else if (mdSort === "desc")
                arr.sort((a, b) => b.value - a.value);
            return arr;
        }, [markdownBaseData, mdSort]);

        const markdownMaxValue = useMemo(() => {
            if (!markdownData.length) return 100;
            const max = Math.max(
                ...markdownData.map((d) => d.value || 0)
            );
            if (!Number.isFinite(max) || max <= 0) return 10;
            const padded = max * 1.1;
            return Math.max(10, Math.ceil(padded));
        }, [markdownData]);

        const rawAgents = metricsData?.agent_metrics || [];
        const agentData = rawAgents.map((a, i) => ({
            ...a,
            yKey: `${a.agent_name} - ${a.position_id} -- ${i}`,
        }));

        const agentDataSorted = useMemo(() => {
            const arr = [...agentData];
            if (agentSort === "asc") {
                arr.sort(
                    (a, b) =>
                        (Number(a.average_qa_score) || 0) -
                        (Number(b.average_qa_score) || 0)
                );
            } else if (agentSort === "desc") {
                arr.sort(
                    (a, b) =>
                        (Number(b.average_qa_score) || 0) -
                        (Number(a.average_qa_score) || 0)
                );
            }
            return arr;
        }, [agentData, agentSort]);

        const barCount =
            agentData.length || combinedData.length || 1;
        let perBarHeight;
        if (barCount <= 5) perBarHeight = 60;
        else if (barCount <= 10) perBarHeight = 45;
        else if (barCount <= 20) perBarHeight = 35;
        else if (barCount <= 50) perBarHeight = 28;
        else perBarHeight = 22;

        const minHeight = 220;
        const chart1Height = Math.max(
            minHeight,
            combinedData.length * perBarHeight + 50
        );
        const chart2Height = Math.max(
            minHeight,
            agentData.length * perBarHeight
        );

        const baseDuration = 550;
        const baseEasing = "cubic-bezier(0.4, 0, 0.2, 1)";
        const perBarDelay = 25;
        const containerDelay = 70;
        const secondChartDelay = containerDelay + 90;

        const cycleSort = (value) => {
            if (value === "none") return "desc";
            if (value === "desc") return "asc";
            return "none";
        };

        const renderSortIcon = (value) => {
            if (value === "asc") return "↑";
            if (value === "desc") return "↓";
            return "↕";
        };

        return (
            <div className="m-4">
                <div className="my-6">
                    <div className="font-bold text-[20px] leading-[32px] tracking-normal text-[#05004E]">
                        Bar Charts
                    </div>
                    <div className="font-medium text-[16px] leading-[30px] tracking-normal text-[#737791]">
                        Audit Summary for Digital Quality Audit Boards and
                        Agent Performance
                    </div>
                </div>

                <div
                    className={`grid gap-6 lg:grid-cols-2 transition-all duration-300 ${isVisible
                            ? "opacity-100 translate-y-0"
                            : "opacity-0 translate-y-2"
                        }`}
                >
                    <div className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-200 border border-slate-100">
                        <div className="flex items-center justify-between mb-2">
                            <div>
                                <h2 className="font-semibold text-lg text-[#1A2347]">
                                    Digital Quality - Categories
                                </h2>
                                <p className="text-xs text-slate-500 mt-1">
                                    Distribution of categories by criticality
                                    type.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() =>
                                    setDqSort((prev) => cycleSort(prev))
                                }
                                className="ml-2 text-sm text-[#6B7280] px-3 py-1 rounded-full border border-slate-200 hover:bg-slate-50"
                            >
                                Sort {renderSortIcon(dqSort)}
                            </button>
                        </div>

                        <div className="flex flex-wrap gap-2 mb-4">
                            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600">
                                <span
                                    className="w-2.5 h-2.5 rounded-full"
                                    style={{ backgroundColor: PRIMARY_COLOR }}
                                />
                                Business Critical
                            </span>
                            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600">
                                <span
                                    className="w-2.5 h-2.5 rounded-full"
                                    style={{
                                        backgroundColor: SECONDARY_COLOR,
                                    }}
                                />
                                Customer Critical
                            </span>
                            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600">
                                <span
                                    className="w-2.5 h-2.5 rounded-full"
                                    style={{ backgroundColor: NEUTRAL_COLOR }}
                                />
                                Non Critical
                            </span>
                        </div>

                        <ResponsiveContainer
                            width="100%"
                            height={chart1Height}
                        >
                            <BarChart
                                data={dqData}
                                layout="vertical"
                                margin={{
                                    top: 20,
                                    right: 80,
                                    left: 10,
                                    bottom: 20,
                                }}
                            >
                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    vertical={false}
                                    stroke="#e5e7eb"
                                />
                                <XAxis
                                    type="number"
                                    domain={[0, 105]}
                                    tick={{
                                        fontSize: 11,
                                        fill: "#9CA3AF",
                                    }}
                                    axisLine={{ stroke: "#e5e7eb" }}
                                    tickLine={{ stroke: "#e5e7eb" }}
                                />
                                <YAxis
                                    type="category"
                                    dataKey="name"
                                    width={260}
                                    interval={0}
                                    tick={({ x, y, payload }) => (
                                        <text
                                            x={x}
                                            y={y}
                                            dy={4}
                                            fontSize={11}
                                            fontWeight={400}
                                            fill="#4B5563"
                                            textAnchor="end"
                                        >
                                            {String(payload.value)
                                                .replace(/_/g, " ")
                                                .replace(
                                                    /\b\w/g,
                                                    (l) => l.toUpperCase()
                                                )}
                                        </text>
                                    )}
                                />
                                <Tooltip
                                    formatter={(value, _, item) => [
                                        formatPercentLabel(value),
                                        item?.payload?.category || "",
                                    ]}
                                    contentStyle={{
                                        backgroundColor:
                                            "rgba(255, 255, 255, 0.98)",
                                        border: "1px solid #E5E7EB",
                                        borderRadius: "12px",
                                        boxShadow:
                                            "0 10px 25px rgba(0,0,0,0.08)",
                                    }}
                                />
                                <Bar
                                    dataKey="value"
                                    barSize={10}
                                    radius={[6, 6, 6, 6]}
                                    isAnimationActive
                                    animationBegin={
                                        containerDelay + 160
                                    }
                                    animationDuration={baseDuration}
                                    animationEasing={baseEasing}
                                >
                                    <LabelList
                                        dataKey="displayValue"
                                        position="right"
                                        style={{
                                            fontSize: 11,
                                            fill: "#111827",
                                            fontWeight: 500,
                                        }}
                                    />
                                    {dqData.map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={
                                                COLORS_MAP[
                                                entry.category
                                                ]
                                            }
                                            style={{
                                                animation: `barGrowIn ${baseDuration}ms ${containerDelay +
                                                    160 +
                                                    index * perBarDelay
                                                    }ms ${baseEasing} both`,
                                                transformOrigin:
                                                    "left center",
                                                filter:
                                                    "drop-shadow(0 1px 3px rgba(0,0,0,0.06))",
                                            }}
                                            className="hover:brightness-110 transition-all duration-150"
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-200 border border-slate-100">
                        <div className="flex items-center justify-between mb-2">
                            <div>
                                <h2 className="font-semibold text-lg text-[#1A2347]">
                                    Markdowns
                                </h2>
                                <p className="text-xs text-slate-500 mt-1">
                                    Areas with higher score reduction (higher
                                    is worse).
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() =>
                                    setMdSort((prev) => cycleSort(prev))
                                }
                                className="ml-2 text-sm text-[#6B7280] px-3 py-1 rounded-full border border-slate-200 hover:bg-slate-50"
                            >
                                Sort {renderSortIcon(mdSort)}
                            </button>
                        </div>

                        <div className="flex flex-wrap gap-2 mb-4">
                            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600">
                                <span
                                    className="w-2.5 h-2.5 rounded-full"
                                    style={{ backgroundColor: PRIMARY_COLOR }}
                                />
                                Business Critical
                            </span>
                            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600">
                                <span
                                    className="w-2.5 h-2.5 rounded-full"
                                    style={{
                                        backgroundColor: SECONDARY_COLOR,
                                    }}
                                />
                                Customer Critical
                            </span>
                            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600">
                                <span
                                    className="w-2.5 h-2.5 rounded-full"
                                    style={{ backgroundColor: NEUTRAL_COLOR }}
                                />
                                Non Critical
                            </span>
                        </div>

                        <ResponsiveContainer
                            width="100%"
                            height={chart1Height}
                        >
                            <BarChart
                                data={markdownData}
                                layout="vertical"
                                margin={{
                                    top: 20,
                                    right: 80,
                                    left: 10,
                                    bottom: 20,
                                }}
                            >
                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    vertical={false}
                                    stroke="#e5e7eb"
                                />
                                <XAxis
                                    type="number"
                                    domain={[0, markdownMaxValue]}
                                    tick={{
                                        fontSize: 11,
                                        fill: "#9CA3AF",
                                    }}
                                    axisLine={{ stroke: "#e5e7eb" }}
                                    tickLine={{ stroke: "#e5e7eb" }}
                                />
                                <YAxis
                                    type="category"
                                    dataKey="name"
                                    width={260}
                                    interval={0}
                                    tick={({ x, y, payload }) => (
                                        <text
                                            x={x}
                                            y={y}
                                            dy={4}
                                            fontSize={11}
                                            fontWeight={400}
                                            fill="#4B5563"
                                            textAnchor="end"
                                        >
                                            {String(payload.value)
                                                .replace(/_/g, " ")
                                                .replace(
                                                    /\b\w/g,
                                                    (l) => l.toUpperCase()
                                                )}
                                        </text>
                                    )}
                                />
                                <Tooltip
                                    formatter={(value, _, item) => [
                                        formatPercentLabel(value),
                                        item?.payload?.category || "",
                                    ]}
                                    contentStyle={{
                                        backgroundColor:
                                            "rgba(255, 255, 255, 0.98)",
                                        border: "1px solid #E5E7EB",
                                        borderRadius: "12px",
                                        boxShadow:
                                            "0 10px 25px rgba(0,0,0,0.08)",
                                    }}
                                />
                                <Bar
                                    dataKey="value"
                                    barSize={10}
                                    radius={[6, 6, 6, 6]}
                                    isAnimationActive
                                    animationBegin={
                                        containerDelay + 200
                                    }
                                    animationDuration={baseDuration}
                                    animationEasing={baseEasing}
                                >
                                    <LabelList
                                        dataKey="displayValue"
                                        position="right"
                                        style={{
                                            fontSize: 11,
                                            fill: "#111827",
                                            fontWeight: 500,
                                        }}
                                    />
                                    {markdownData.map((entry, index) => (
                                        <Cell
                                            key={`markdown-cell-${index}`}
                                            fill={
                                                COLORS_MAP[
                                                entry.category
                                                ]
                                            }
                                            style={{
                                                animation: `barGrowIn ${baseDuration}ms ${containerDelay +
                                                    200 +
                                                    index * perBarDelay
                                                    }ms ${baseEasing} both`,
                                                transformOrigin:
                                                    "left center",
                                                filter:
                                                    "drop-shadow(0 1px 3px rgba(0,0,0,0.06))",
                                            }}
                                            className="hover:brightness-110 transition-all duration-150"
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div
                    className={`mt-6 bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-200 border border-slate-100 ${isVisible
                            ? "opacity-100 translate-y-0"
                            : "opacity-0 translate-y-2"
                        }`}
                >
                    <div className="flex items-center justify-between mb-2">
                        <div>
                            <h2 className="font-semibold text-lg text-[#1A2347]">
                                Agent Performance
                            </h2>
                            <p className="text-xs text-slate-500 mt-1">
                                Average QA score per agent (0–10).
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() =>
                                setAgentSort((prev) => cycleSort(prev))
                            }
                            className="ml-2 text-sm text-[#6B7280] px-3 py-1 rounded-full border border-slate-200 hover:bg-slate-50"
                        >
                            Sort {renderSortIcon(agentSort)}
                        </button>
                    </div>

                    <ResponsiveContainer
                        width="100%"
                        height={chart2Height}
                    >
                        <BarChart
                            data={agentDataSorted}
                            layout="vertical"
                            margin={{
                                top: 20,
                                right: 80,
                                left: 10,
                                bottom: 20,
                            }}
                        >
                            <CartesianGrid
                                strokeDasharray="1 1"
                                vertical={false}
                                stroke="#e5e7eb"
                            />
                            <XAxis
                                type="number"
                                domain={[0, 10]}
                                tick={{
                                    fontSize: 11,
                                    fill: "#9CA3AF",
                                }}
                                axisLine={{ stroke: "#e5e7eb" }}
                                tickLine={{ stroke: "#e5e7eb" }}
                            />
                            <YAxis
                                type="category"
                                dataKey="yKey"
                                width={260}
                                interval={0}
                                tick={({ x, y, payload }) => {
                                    const item =
                                        agentDataSorted.find(
                                            (d) =>
                                                d.yKey === payload.value
                                        );
                                    const label =
                                        item?.agent_name ??
                                        payload.value;
                                    return (
                                        <text
                                            x={x}
                                            y={y}
                                            dy={4}
                                            fontSize={11}
                                            fontWeight={400}
                                            fill="#4B5563"
                                            textAnchor="end"
                                        >
                                            {label}
                                        </text>
                                    );
                                }}
                            />
                            <Tooltip
                                formatter={(value, _, item) => [
                                    value,
                                    item?.payload?.agent_name ||
                                    "Agent",
                                ]}
                                contentStyle={{
                                    backgroundColor:
                                        "rgba(255, 255, 255, 0.98)",
                                    border: "1px solid #E5E7EB",
                                    borderRadius: "12px",
                                    boxShadow:
                                        "0 10px 25px rgba(0,0,0,0.08)",
                                }}
                            />
                            <Bar
                                dataKey="average_qa_score"
                                fill={PRIMARY_COLOR}
                                barSize={10}
                                radius={[6, 6, 6, 6]}
                                isAnimationActive
                                animationBegin={
                                    secondChartDelay + 160
                                }
                                animationDuration={baseDuration}
                                animationEasing={baseEasing}
                            >
                                <LabelList
                                    dataKey="average_qa_score"
                                    position="right"
                                    style={{
                                        fontSize: 11,
                                        fill: "#111827",
                                        fontWeight: 500,
                                    }}
                                />
                                {agentDataSorted.map((_, index) => (
                                    <Cell
                                        key={`agent-cell-${index}`}
                                        style={{
                                            animation: `barGrowIn ${baseDuration}ms ${secondChartDelay +
                                                160 +
                                                index * perBarDelay
                                                }ms ${baseEasing} both`,
                                            transformOrigin:
                                                "left center",
                                            filter:
                                                "drop-shadow(0 1px 3px rgba(0,0,0,0.06))",
                                        }}
                                        className="hover:brightness-110 transition-all duration-150"
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        );
    };

    const tabData = [
        {
            key: "dqab",
            label: "Digital Quality Audit Boards",
            content: <DigitalQABoards />,
        },
        {
            key: "bar",
            label: "Bar Charts",
            content: <BarChartGraph />,
        },
        {
            key: "critical",
            label: "Critical Metrics",
            content: <CriticalMetrics />,
        },
        {
            key: "recent",
            label: "Recent Evaluation",
            content: <RecentEvaluation />,
        },
        {
            key: "agent",
            label: "Agent Quality Audit",
            content: <AgentQualityAudit />,
        },
    ];

    const handleApply = () => {
        if (!accountName || !agentName || !startDate || !endDate) {
            showToast("Please fill all the required fields", {
                type: "error",
                duration: 9000,
                position: "bottom-right",
                onClose: () => setToast(null),
            });
            return;
        }
        handleFetchMetrics();
    };

    const handleClear = () => {
        setAccountName(null);
        setAgentName(null);
        setStartDate(null);
        setEndDate(null);
        setSentimentFilter(null);
        localStorage.removeItem("selectedAccount");
        localStorage.removeItem("selectedAgent");
        localStorage.removeItem("selectedStartDate");
        localStorage.removeItem("selectedEndDate");
        setMetricsData(null);
    };

    const handleDateApply = React.useCallback((start, end) => {
        setStartDate((prev) => {
            if (!start && !prev) return prev;
            if (!start || !prev) return start || null;
            return start.getTime() !== prev.getTime() ? start : prev;
        });
        setEndDate((prev) => {
            if (!end && !prev) return prev;
            if (!end || !prev) return end || null;
            return end.getTime() !== prev.getTime() ? end : prev;
        });
    }, []);

    return (
        <div>
            {loading && <Loader />}
            {toast && <Toast {...toast} />}

            <div className="border border-[#E2E2E2] p-6">
                <div className="font-semibold text-[#26203B] mb-2 text-xl leading-none tracking-normal">
                    Account & Agent Details
                </div>
                <div className="font-medium text-[#313133] text-sm leading-none tracking-normal">
                    Enter the details for Account name and Agents in order to see
                    the details.
                </div>

                <div className="mt-6 flex gap-4 flex-wrap">
                    <div className="mt-[5px] flex gap-2 flex-col">
                        <span className="font-medium text-[#111827] text-base leading-none tracking-normal">
                            Date Range <span className="text-[#ef4444]">*</span>
                        </span>
                        <DateRangePicker
                            startDate={startDate}
                            endDate={endDate}
                            onApply={handleDateApply}
                            autoApply={true}
                        />
                    </div>
                    <div>
                        <InputSelect
                            title="Account Name"
                            required
                            options={accounts?.map((item) => ({
                                label: item.account_name,
                                value: item.account_id,
                            }))}
                            value={accountName}
                            onChange={handleAccountChange}
                            placeholder="Select Account Name"
                        />
                    </div>
                    <div>
                        <InputSelect
                            title="Agents"
                            required
                            options={agents?.map((item) => ({
                                label: item.agent_name,
                                value: item.position_id,
                            }))}
                            value={agentName}
                            showSelectAll={true}
                            onChange={setAgentName}
                            multi
                            placeholder="Select Agents"
                        />
                    </div>
                </div>

                <div className="mt-6 flex gap-3 justify-end">
                    <Button
                        onClick={handleClear}
                        className="btn-secondary-active !px-5 !py-2"
                    >
                        Clear
                    </Button>
                    <Button
                        onClick={handleApply}
                        className="btn-default-active !px-5 !py-2"
                    >
                        Apply
                    </Button>
                </div>
            </div>

            <div className="my-8">
                {metricsData ? (
                    <Tabs
                        className="!max-w-full [&_.tabs-header]:text-[16px]"
                        tabs={tabData}
                        activeKey={activeTab}
                        onTabChange={(id) => {
                            setActiveTab(id);
                            setSentimentFilter(null);
                        }}
                    />
                ) : (
                    <NoContent className="!w-full" />
                )}
            </div>
        </div>
    );
};

export default Dashboard;
