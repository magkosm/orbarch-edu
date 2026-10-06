import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { downloadCSV } from '../utils/csvExport';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler,
    ArcElement
} from 'chart.js';
import { Line, Pie } from 'react-chartjs-2';

// Register ChartJS components
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler,
    ArcElement
);

const MatbResults = ({ logs, finalScore }) => {
    const { t } = useTranslation();

    // No logs here

    // Calculate accuracies for each task
    const calculateAccuracy = (taskLogs, taskType) => {
        if (!taskLogs || taskLogs.length === 0) {
            return { correct: 0, incorrect: 0, accuracy: 0, total: 0 };
        }

        let correct = 0;
        let incorrect = 0;
        let totalCounted = 0;

        if (taskType === 'comm') {
            // For comms, check for 'HIT' or 'CR' (Correct Rejection) vs 'MISS' or 'FA'
            // Only count logs that have a Remarks field
            taskLogs.forEach(log => {
                if (log.Remarks !== undefined && log.Remarks !== null && log.Remarks !== '') {
                    totalCounted++;
                    if (log.Remarks === 'HIT' || log.Remarks === 'CR') {
                        correct++;
                    } else if (log.Remarks === 'MISS' || log.Remarks === 'FA') {
                        incorrect++;
                    }
                }
            });
        } else if (taskType === 'resource') {
            // For resource, check tank range status (corrA && corrB)
            // Only count logs that have corrA/corrB fields (not event logs)
            taskLogs.forEach(log => {
                if (log.corrA !== undefined && log.corrB !== undefined) {
                    totalCounted++;
                    if (log.corrA && log.corrB) {
                        correct++;
                    } else {
                        incorrect++;
                    }
                }
            });
        } else if (taskType === 'monitoring') {
            // For monitoring, check type (HIT vs MISS/FA)
            // Only count logs that have a type field
            taskLogs.forEach(log => {
                if (log.type !== undefined && log.type !== null && log.type !== '') {
                    totalCounted++;
                    if (log.type === 'HIT') {
                        correct++;
                    } else if (log.type === 'MISS' || log.type === 'FA') {
                        incorrect++;
                    }
                }
            });
        } else if (taskType === 'tracking') {
            // For tracking, check isWithinTarget - sample every 10th entry to avoid massive data
            const sampledLogs = taskLogs.filter((_, index) => index % 10 === 0);
            sampledLogs.forEach(log => {
                if (log.isWithinTarget !== undefined) {
                    totalCounted++;
                    if (log.isWithinTarget) {
                        correct++;
                    } else {
                        incorrect++;
                    }
                }
            });
        }

        const total = correct + incorrect;
        // If no valid logs were counted, return 0 accuracy
        // This prevents showing 100% when logs are empty or invalid
        return {
            correct,
            incorrect,
            total: totalCounted,
            accuracy: total > 0 ? (correct / total) * 100 : (totalCounted === 0 ? 0 : NaN)
        };
    };

    const commAccuracy = calculateAccuracy(logs.comm, 'comm');
    const resourceAccuracy = calculateAccuracy(logs.resource, 'resource');
    const monitoringAccuracy = calculateAccuracy(logs.monitoring, 'monitoring');
    const trackingAccuracy = calculateAccuracy(logs.tracking, 'tracking');

    // Prepare chart data for Performance (Load & Health)
    const performanceChartData = useMemo(() => {
        if (!logs.performance || logs.performance.length === 0) {
            console.log('No performance data available');
            return null;
        }

        console.log(`Performance data: ${logs.performance.length} entries`);
        console.log('Sample performance entry:', logs.performance[0]);

        return {
            labels: logs.performance.map(d => {
                // Use timestamp field
                const timeVal = d.timestamp || d.time;
                if (!timeVal) return '';
                const dateObj = new Date(timeVal);
                return `${dateObj.getMinutes()}:${dateObj.getSeconds().toString().padStart(2, '0')}`;
            }),
            datasets: [
                {
                    label: t('systemStatus.load', 'System Load'),
                    data: logs.performance.map(d => Number(d.load) || Number(d.systemLoad) || 0),
                    borderColor: 'rgb(255, 99, 132)',
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    fill: true,
                    tension: 0.2,
                    yAxisID: 'y'
                },
                {
                    label: t('systemStatus.health', 'System Health'),
                    data: logs.performance.map(d => Number(d.health) || 0),
                    borderColor: 'rgb(53, 162, 235)',
                    backgroundColor: 'rgba(53, 162, 235, 0.2)',
                    fill: true,
                    tension: 0.2,
                    yAxisID: 'y1'
                }
            ]
        };
    }, [logs.performance, t]);

    const handleExportData = () => {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

        // Export Performance Logs
        if (logs.performance && logs.performance.length > 0) {
            downloadCSV(logs.performance, `matb_performance_${timestamp}`);
        }

        // Export Task Logs
        if (logs.comm && logs.comm.length > 0) {
            downloadCSV(logs.comm, `matb_comm_logs_${timestamp}`);
        }
        if (logs.resource && logs.resource.length > 0) {
            downloadCSV(logs.resource, `matb_resource_logs_${timestamp}`);
        }
        if (logs.monitoring && logs.monitoring.length > 0) {
            downloadCSV(logs.monitoring, `matb_monitoring_logs_${timestamp}`);
        }
        if (logs.tracking && logs.tracking.length > 0) {
            // Sample tracking logs if too large? 
            // For now export all, but maybe user wants raw data.
            downloadCSV(logs.tracking, `matb_tracking_logs_${timestamp}`);
        }

        // Create a summary CSV
        const summaryData = [{
            finalScore,
            commAccuracy: commAccuracy.accuracy.toFixed(2),
            resourceAccuracy: resourceAccuracy.accuracy.toFixed(2),
            monitoringAccuracy: monitoringAccuracy.accuracy.toFixed(2),
            trackingAccuracy: trackingAccuracy.accuracy.toFixed(2),
            date: new Date().toLocaleString()
        }];
        downloadCSV(summaryData, `matb_summary_${timestamp}`);
    };

    // Chart options are built inside the component (memoised on `t`) so their
    // titles re-render when the language changes.
    const performanceOptions = useMemo(() => ({
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'top', labels: { color: 'white' } },
            title: { display: true, text: t('matbResults.perfOverTime', 'System performance over time'), color: 'white' }
        },
        scales: {
            y: {
                type: 'linear',
                display: true,
                position: 'left',
                min: 0,
                max: 100,
                title: { display: true, text: t('matbResults.load', 'Load (%)'), color: 'white' },
                ticks: { color: 'white' },
                grid: { color: 'rgba(255, 255, 255, 0.1)' }
            },
            y1: {
                type: 'linear',
                display: true,
                position: 'right',
                // min/max for health depends on if it's 0-100 or relative
                // Assuming 0-100 for cumulative health
                min: 0,
                max: 100,
                grid: { drawOnChartArea: false },
                title: { display: true, text: t('matbResults.health', 'Health (%)'), color: 'white' },
                ticks: { color: 'white' }
            },
            x: {
                ticks: { color: 'white' },
                grid: { color: 'rgba(255, 255, 255, 0.1)' }
            }
        }
    }), [t]);

    // Helper for Pie Charts
    const createPieData = (accData, label) => ({
        labels: [t('common.correct', 'Correct'), t('common.incorrect', 'Incorrect')],
        datasets: [
            {
                label,
                data: [accData.correct, accData.incorrect],
                backgroundColor: ['rgba(75, 192, 192, 0.6)', 'rgba(255, 99, 132, 0.6)'],
                borderColor: ['rgba(75, 192, 192, 1)', 'rgba(255, 99, 132, 1)'],
                borderWidth: 1,
            },
        ],
    });

    const pieOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'bottom', labels: { color: 'white', boxWidth: 10, padding: 10 } },
            title: { display: false }
        }
    };

    // Prepare chart data for Tracking Task performance
    const trackingChartData = useMemo(() => {
        if (!logs.tracking || logs.tracking.length === 0) {
            return null;
        }

        // Filter for actual tracking logs (they have rmsError) and sample to avoid massive data
        // Sample every 30th entry (approx 2Hz if logged at 60Hz)
        const sampledTracking = logs.tracking
            .filter(d => d.rmsError !== undefined)
            .filter((_, index) => index % 30 === 0);

        if (sampledTracking.length === 0) return null;

        return {
            labels: sampledTracking.map(d => {
                const dateObj = new Date(d.time);
                return `${dateObj.getMinutes()}:${dateObj.getSeconds().toString().padStart(2, '0')}`;
            }),
            datasets: [
                {
                    label: t('tasks.tracking.title', 'Tracking Error (RMS)'),
                    data: sampledTracking.map(d => d.rmsError),
                    borderColor: 'rgb(75, 192, 192)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 0
                }
            ]
        };
    }, [logs.tracking, t]);

    const trackingOptions = useMemo(() => ({
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'top', labels: { color: 'white' } },
            title: { display: true, text: t('matbResults.trackingPerf', 'Tracking Performance (Lower is Better)'), color: 'white' }
        },
        scales: {
            y: {
                min: 0,
                grid: { color: 'rgba(255, 255, 255, 0.1)' },
                ticks: { color: 'white' },
                title: { display: true, text: t('matbResults.rmsError', 'RMS Error'), color: 'white' }
            },
            x: {
                ticks: { color: 'white' },
                grid: { color: 'rgba(255, 255, 255, 0.1)' }
            }
        }
    }), [t]);

    return (
        <div style={{ width: '100%', color: 'white' }}>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <h2 style={{ margin: '0 0 10px 0' }}>{t('gameOver.finalScore')}: {finalScore}</h2>
                <button
                    onClick={handleExportData}
                    style={{
                        backgroundColor: '#4CAF50',
                        color: 'white',
                        padding: '10px 20px',
                        fontSize: '16px',
                        cursor: 'pointer',
                        border: 'none',
                        borderRadius: '4px'
                    }}
                >
                    {t('matbResults.exportCsv', 'Export data (CSV)')}
                </button>
            </div>

            {/* Performance Plot (Time) */}
            <div style={{ height: '250px', marginBottom: '20px', background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '8px' }}>
                {performanceChartData ? (
                    <Line data={performanceChartData} options={performanceOptions} />
                ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>{t('matbResults.noPerfData', 'No performance data')}</div>
                )}
            </div>

            {/* Tracking Performance Plot */}
            <div style={{ height: '250px', marginBottom: '30px', background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '8px' }}>
                {trackingChartData ? (
                    <Line data={trackingChartData} options={trackingOptions} />
                ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>{t('matbResults.noTrackingData', 'No tracking performance data')}</div>
                )}
            </div>

            {/* Accuracy Pie Charts */}
            <div style={{
                display: 'flex',
                flexDirection: 'row',
                justifyContent: 'space-around',
                flexWrap: 'wrap',
                gap: '20px',
                marginBottom: '30px'
            }}>
                {/* Communications */}
                <div style={{ textAlign: 'center', flex: '1 1 150px', maxWidth: '200px' }}>
                    <h4 style={{ fontSize: '14px', marginBottom: '10px' }}>{t('tasks.communications.title')}</h4>
                    <div style={{ height: '150px' }}>
                        <Pie data={createPieData(commAccuracy, 'Comms')} options={pieOptions} />
                    </div>
                    <p style={{ fontSize: '12px', marginTop: '5px' }}>{commAccuracy.accuracy.toFixed(1)}%</p>
                </div>

                {/* Monitoring */}
                <div style={{ textAlign: 'center', flex: '1 1 150px', maxWidth: '200px' }}>
                    <h4 style={{ fontSize: '14px', marginBottom: '10px' }}>{t('tasks.monitoring.title')}</h4>
                    <div style={{ height: '150px' }}>
                        <Pie data={createPieData(monitoringAccuracy, 'Monitoring')} options={pieOptions} />
                    </div>
                    <p style={{ fontSize: '12px', marginTop: '5px' }}>{monitoringAccuracy.accuracy.toFixed(1)}%</p>
                </div>

                {/* Tracking */}
                <div style={{ textAlign: 'center', flex: '1 1 150px', maxWidth: '200px' }}>
                    <h4 style={{ fontSize: '14px', marginBottom: '10px' }}>{t('tasks.tracking.title')}</h4>
                    <div style={{ height: '150px' }}>
                        <Pie data={createPieData(trackingAccuracy, 'Tracking')} options={pieOptions} />
                    </div>
                    <p style={{ fontSize: '12px', marginTop: '5px' }}>{trackingAccuracy.accuracy.toFixed(1)}%</p>
                </div>

                {/* Resource */}
                <div style={{ textAlign: 'center', flex: '1 1 150px', maxWidth: '200px' }}>
                    <h4 style={{ fontSize: '14px', marginBottom: '10px' }}>{t('tasks.resource.title')}</h4>
                    <div style={{ height: '150px' }}>
                        <Pie data={createPieData(resourceAccuracy, 'Resource')} options={pieOptions} />
                    </div>
                    <p style={{ fontSize: '12px', marginTop: '5px' }}>{resourceAccuracy.accuracy.toFixed(1)}%</p>
                </div>
            </div>
        </div>
    );
};

export default MatbResults;