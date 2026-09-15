#!/usr/bin/env python3
"""Merge cover.pdf (page 0) + body.pdf into the final deliverable."""
from pypdf import PdfReader, PdfWriter

A4_W, A4_H = 595.28, 841.89

COVER = '/home/z/my-project/scripts/cover.pdf'
BODY = '/home/z/my-project/scripts/body.pdf'
OUT = '/home/z/my-project/download/Ammonia_Plant_Builder_Agent_Research_and_Enhancement_Plan.pdf'


def normalize_page_to_a4(page):
    box = page.mediabox
    w, h = float(box.width), float(box.height)
    if abs(w - A4_W) > 0.1 or abs(h - A4_H) > 0.1:
        page.scale_to(A4_W, A4_H)
        # force exact mediabox to avoid sub-point drift
        page.mediabox.lower_left = (0, 0)
        page.mediabox.upper_right = (A4_W, A4_H)
    return page


writer = PdfWriter()
cover_page = PdfReader(COVER).pages[0]
writer.add_page(normalize_page_to_a4(cover_page))
for page in PdfReader(BODY).pages:
    writer.add_page(normalize_page_to_a4(page))
writer.add_metadata({
    '/Title': 'Ammonia Plant Builder Agent — Pre-Build Research and Enhancement Plan',
    '/Author': 'Z.ai',
    '/Creator': 'Z.ai',
    '/Subject': 'Pre-build research, plan stress test, interactivity roadmap and technology stack for an ammonia plant builder agent',
})
with open(OUT, 'wb') as f:
    writer.write(f)
print('Final PDF:', OUT)
print('Total pages:', len(writer.pages))
