"""
dicom_convert.py — DICOM metadata extraction + proper slice ordering
Replaces the old JPEG conversion approach.

POST /api/dicom/sort
  body: { "folder_path": "...", "study_id": "uuid" }
  returns ordered file list with DICOM metadata

GET /api/dicom/status
  returns availability of pydicom
"""

import os
import re
import shutil
from pathlib import Path
from typing import List, Optional, Dict, Any

from fastapi import APIRouter
from loguru import logger
from pydantic import BaseModel

router = APIRouter(prefix="/api/dicom", tags=["dicom"])


class SortRequest(BaseModel):
    folder_path: str
    study_id: str


class SortedFile(BaseModel):
    storedName: str
    originalName: str
    filePath: str
    instanceNumber: Optional[int] = None
    sliceLocation: Optional[float] = None
    imagePositionPatient: Optional[str] = None
    acquisitionDate: Optional[str] = None


class StudyMetadata(BaseModel):
    studyUID: Optional[str] = None
    seriesUID: Optional[str] = None
    modality: Optional[str] = None
    acquisitionDate: Optional[str] = None
    patientName: Optional[str] = None
    sliceCount: int = 0


class SortResponse(BaseModel):
    success: bool
    ordered_files: List[SortedFile]
    metadata: StudyMetadata
    message: str = ""


def natural_sort_key(name: str):
    """Sort filenames naturally: 1-001.dcm before 1-002.dcm"""
    return [int(c) if c.isdigit() else c.lower() for c in re.split(r'(\d+)', name)]


def extract_dicom_meta(filepath: Path) -> Dict[str, Any]:
    """Extract sorting metadata from a DICOM file. Returns {} on failure."""
    try:
        import pydicom
        ds = pydicom.dcmread(str(filepath), stop_before_pixels=True, force=True)
        meta = {}

        # Slice ordering fields
        if hasattr(ds, 'InstanceNumber'):
            try:
                meta['instanceNumber'] = int(ds.InstanceNumber)
            except Exception:
                pass

        if hasattr(ds, 'SliceLocation'):
            try:
                meta['sliceLocation'] = float(ds.SliceLocation)
            except Exception:
                pass

        if hasattr(ds, 'ImagePositionPatient') and len(ds.ImagePositionPatient) >= 3:
            try:
                pos = [float(v) for v in ds.ImagePositionPatient]
                meta['imagePositionPatient'] = f"{pos[0]}\\{pos[1]}\\{pos[2]}"
                meta['imagePositionZ'] = pos[2]  # used for sorting
            except Exception:
                pass

        # Study-level metadata
        for tag, key in [
            ('StudyInstanceUID',  'studyUID'),
            ('SeriesInstanceUID', 'seriesUID'),
            ('Modality',          'modality'),
            ('AcquisitionDate',   'acquisitionDate'),
            ('StudyDate',         'studyDate'),
        ]:
            if hasattr(ds, tag):
                try:
                    meta[key] = str(getattr(ds, tag)).strip()
                except Exception:
                    pass

        if hasattr(ds, 'PatientName'):
            try:
                meta['patientName'] = str(ds.PatientName)
            except Exception:
                pass

        return meta

    except Exception as e:
        logger.debug(f"Could not read DICOM meta from {filepath.name}: {e}")
        return {}


def sort_dicom_files(files: List[Path], metas: List[Dict]) -> List[int]:
    """
    Return sorted indices for files based on DICOM metadata.
    Priority:
      1. InstanceNumber (most reliable)
      2. SliceLocation
      3. ImagePositionPatient Z coordinate
      4. Natural filename sort (fallback)
    """
    indexed = list(enumerate(zip(files, metas)))

    # Check which sort key is available
    has_instance = any('instanceNumber' in m for _, (_, m) in indexed)
    has_slice    = any('sliceLocation' in m for _, (_, m) in indexed)
    has_position = any('imagePositionZ' in m for _, (_, m) in indexed)

    if has_instance:
        logger.info("Sorting by InstanceNumber")
        indexed.sort(key=lambda x: (x[1][1].get('instanceNumber', 99999), natural_sort_key(x[1][0].name)))
    elif has_slice:
        logger.info("Sorting by SliceLocation")
        indexed.sort(key=lambda x: (x[1][1].get('sliceLocation', 0.0), natural_sort_key(x[1][0].name)))
    elif has_position:
        logger.info("Sorting by ImagePositionPatient Z")
        indexed.sort(key=lambda x: (x[1][1].get('imagePositionZ', 0.0), natural_sort_key(x[1][0].name)))
    else:
        logger.info("Sorting by filename (natural order) — no DICOM metadata found")
        indexed.sort(key=lambda x: natural_sort_key(x[1][0].name))

    return [orig_idx for orig_idx, _ in indexed]


@router.post("/sort", response_model=SortResponse)
async def sort_dicom_series(req: SortRequest):
    """
    Sort DICOM files by metadata and rename them sequentially.
    Renames files in-place: 0001.dcm, 0002.dcm, ...
    """
    folder = Path(req.folder_path)
    if not folder.exists() or not folder.is_dir():
        return SortResponse(
            success=False, ordered_files=[], metadata=StudyMetadata(),
            message=f"Folder not found: {folder}"
        )

    # Collect all DICOM / image files (ignore subdirs)
    all_files = [
        f for f in folder.iterdir()
        if f.is_file() and not f.name.startswith('.')
    ]

    # Skip if already sorted (all files are 0001.dcm pattern)
    dicom_files = sorted(all_files, key=lambda f: natural_sort_key(f.name))
    if not dicom_files:
        return SortResponse(
            success=False, ordered_files=[], metadata=StudyMetadata(),
            message="No files found in folder"
        )

    logger.info(f"Processing {len(dicom_files)} files for study {req.study_id}")

    # Extract metadata (read headers only — fast, no pixel data)
    metas = [extract_dicom_meta(f) for f in dicom_files]

    # Determine sort order
    sorted_indices = sort_dicom_files(dicom_files, metas)
    sorted_files   = [dicom_files[i] for i in sorted_indices]
    sorted_metas   = [metas[i] for i in sorted_indices]

    # Rename sequentially in a temp pass to avoid name conflicts
    # Pass 1: rename to tmp names
    tmp_paths = []
    for i, f in enumerate(sorted_files):
        tmp = folder / f"_sort_tmp_{i:04d}{f.suffix}"
        f.rename(tmp)
        tmp_paths.append(tmp)

    # Pass 2: rename to final sequential names
    ext = tmp_paths[0].suffix.lower() if tmp_paths else '.dcm'
    final_files: List[SortedFile] = []

    for i, (tmp, orig_file, meta) in enumerate(zip(tmp_paths, sorted_files, sorted_metas)):
        # Keep original extension
        file_ext    = orig_file.suffix.lower() or '.dcm'
        stored_name = f"{i + 1:04d}{file_ext}"
        dest        = folder / stored_name
        tmp.rename(dest)

        sf = SortedFile(
            storedName=stored_name,
            originalName=orig_file.name,
            filePath=str(dest).replace("\\", "/"),
            instanceNumber=meta.get('instanceNumber'),
            sliceLocation=meta.get('sliceLocation'),
            imagePositionPatient=meta.get('imagePositionPatient'),
            acquisitionDate=meta.get('acquisitionDate') or meta.get('studyDate'),
        )
        final_files.append(sf)

    # Build study-level metadata from first file with data
    study_meta = StudyMetadata(sliceCount=len(final_files))
    for m in sorted_metas:
        if not study_meta.studyUID and m.get('studyUID'):
            study_meta.studyUID = m['studyUID']
        if not study_meta.seriesUID and m.get('seriesUID'):
            study_meta.seriesUID = m['seriesUID']
        if not study_meta.modality and m.get('modality'):
            study_meta.modality = m['modality']
        if not study_meta.acquisitionDate and (m.get('acquisitionDate') or m.get('studyDate')):
            study_meta.acquisitionDate = m.get('acquisitionDate') or m.get('studyDate')
        if not study_meta.patientName and m.get('patientName'):
            study_meta.patientName = m['patientName']

    logger.info(f"Sort complete: {len(final_files)} files, UID={study_meta.studyUID}")

    return SortResponse(
        success=True,
        ordered_files=final_files,
        metadata=study_meta,
        message=f"Sorted {len(final_files)} files successfully"
    )


@router.get("/status")
async def dicom_status():
    """Check if pydicom is available."""
    try:
        import pydicom
        return {
            "available": True,
            "pydicom": pydicom.__version__,
            "features": ["sort", "metadata_extraction", "cornerstone_compatible"]
        }
    except ImportError as e:
        return {"available": False, "error": str(e)}
