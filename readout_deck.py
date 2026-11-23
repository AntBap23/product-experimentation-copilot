from io import BytesIO

from pptx import Presentation
from pptx.chart.data import CategoryChartData
from pptx.dml.color import RGBColor
from pptx.enum.chart import XL_CHART_TYPE
from pptx.util import Inches, Pt

from analysis_engine import DESIGN, HYPOTHESIS


def export_readout(readout, interpretation):
    deck = Presentation()
    deck.slide_width = Inches(13.33)
    deck.slide_height = Inches(7.5)

    def add_slide(title, lines):
        slide = deck.slides.add_slide(deck.slide_layouts[5])
        slide.background.fill.solid()
        slide.background.fill.fore_color.rgb = RGBColor.from_string("F4F7F7")
        heading = slide.shapes.title.text_frame.paragraphs[0]
        heading.text = title
        heading.font.size = Pt(36)
        heading.font.color.rgb = RGBColor.from_string("123637")
        box = slide.shapes.add_textbox(Inches(0.8), Inches(1.65), Inches(11.6), Inches(5.2))
        box.text_frame.word_wrap = True
        for index, line in enumerate(lines):
            paragraph = box.text_frame.paragraphs[0] if index == 0 else box.text_frame.add_paragraph()
            paragraph.text = line
            paragraph.font.size = Pt(22)
            paragraph.space_after = Pt(18)
        return slide

    add_slide("Mobile checkout experiment", [
        f"Synthetic demo through {readout.as_of:%B %d, %Y}",
        readout.status,
        interpretation or "Analyst interpretation pending.",
    ])
    add_slide("Hypothesis and design", [HYPOTHESIS, *DESIGN])

    arms = [readout.control, readout.treatment]
    summary = "   |   ".join(
        f"{arm.name} {arm.purchases:,}/{arm.assigned:,} ({arm.rate:.1%})" for arm in arms
    )
    if readout.effect:
        effect, low, high = readout.effect
        effect_note = f"Lift {effect * 100:+.2f} pp (95% CI {low * 100:+.2f} to {high * 100:+.2f} pp)."
    else:
        effect_note = "Inference withheld. See experiment status."
    slide = add_slide("Purchase conversion by variant", [summary, effect_note])

    data = CategoryChartData()
    data.categories = [arm.name for arm in arms]
    data.add_series("Purchase conversion", [arm.rate for arm in arms], "0.0%")
    chart = slide.shapes.add_chart(
        XL_CHART_TYPE.COLUMN_CLUSTERED, Inches(0.8), Inches(3.05),
        Inches(11.65), Inches(3.85), data,
    ).chart
    chart.value_axis.minimum_scale = 0
    chart.value_axis.maximum_scale = 1
    chart.value_axis.tick_labels.number_format = "0%"
    chart.series[0].format.fill.solid()
    chart.series[0].format.fill.fore_color.rgb = RGBColor.from_string("087F76")

    add_slide("Experiment health and methods", [
        f"Observed traffic split check p-value {readout.split_p_value:.3g}. Alert threshold 0.01.",
        "Conversion uses assigned users with a full 24-hour outcome window.",
        "The planned readout uses a two-sided normal approximation for the difference in proportions.",
        "Source: synthetic aggregate fixtures. Guardrail outcomes are unavailable.",
    ])

    output = BytesIO()
    deck.save(output)
    return output.getvalue()
